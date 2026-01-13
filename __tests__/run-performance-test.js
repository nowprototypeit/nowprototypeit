#!/usr/bin/env node

const underpowered = process.env.NPI_PERF_UNDERPOWERED === 'true'
const skipDev = process.env.NPI_PERF_SKIP_DEV === 'true'
const skipServe = process.env.NPI_PERF_SKIP_SERVE === 'true'
const skipPreBuilt = process.env.NPI_PERF_SKIP_SERVE_PRE_BUILT === 'true'
const depToTest = process.env.NPI_PERF_DEP_TO_TEST

if (underpowered) {
  console.log('Running with underpowered benchmark expectations - this is based on the GitHub runners')
}

const path = require('path')
const os = require('os')
const { execv2 } = require('../lib/exec')

const kitDir = path.join(os.tmpdir(), 'npi-perf', 'kit')
const packDir = path.join(os.tmpdir(), 'npi-perf', 'pack')

const { mkdirSync, rmSync, existsSync } = require('fs')

;[kitDir, packDir].forEach((dir) => {
  if (existsSync(kitDir)) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }
  mkdirSync(dir, { recursive: true })
})

const execArgs = {
  cwd: kitDir,
  passThroughEnv: true
}

const numberOfRuns = Number(process.argv[2]) || 20
const numberOfDevRuns = Math.ceil(numberOfRuns / 2)
const npiVersionToCompare = '0.11.2'
const govukFrontendVersion = '5.9.0'
const minimumAcceptablePercentageImprovements = {
  // Note: These are set quite low compared to what we're seeing.  The last run on GitHub actions (`ubuntu-latest`) was:
  //
  // preBuilt: Succeeded with a 64.89% improvement
  // serve: Succeeded with a 8.11% improvement
  // dev: Succeeded with a 26.22% improvement
  //
  // On a developer laptop we're seeing:
  //
  // preBuilt: Succeeded with a 59.36% improvement
  // serve: Succeeded with a 7.08% improvement
  // dev: Succeeded with a 22.31% improvement
  //
  // And another run on a developer laptop:
  //
  // preBuilt: Succeeded with a 61.85% improvement
  // serve: Succeeded with a 10% improvement
  // dev: Succeeded with a 28.17% improvement
  //
  // The minimum acceptable percentages are set low to avoid this being an annoying test that fails because of natural variations between runs.
  preBuilt: 55,
  serve: 4,
  dev: 10
}
async function runPerformanceTest (command, numberOfRuns, benchmark = undefined) {
  const process = execv2(`${path.join(__dirname, 'single-performance-run.js')} ${kitDir} ${numberOfRuns} ${command}`, {
    ...execArgs,
    env: {
      ...(execArgs.env || {}),
      NPI_PERF__BENCHMARK_MS: benchmark,
      NPI_PERF__SKIP_LOG_CHECK: benchmark ? 'false' : 'true'
    }
  })
  let result =
    process.stdio.stdout.on('data', async (data) => {
      const str = data.toString()
      const startMatch = 'Total time: ['
      const endMatch = ']ms'
      if (str.includes(startMatch)) {
        console.log('')
        console.log('- - - - - - -')
        console.log('')
        console.log('Summary:')
        console.log('')
        console.log(startMatch, str.split(startMatch)[1])
        console.log('')
        console.log('- - - - - - -')
        console.log('')
        result = str.split(startMatch)[1].split(endMatch)[0]
      }
    })
  await process.finishedPromise
  if (!result) {
    throw new Error('Failed to get result from performance test - maybe the output format changed?')
  }
  return Number(result)
}

async function packIfNeededAndGetDependencyIdentifier () {
  if (depToTest) {
    return depToTest
  }
  await execv2(`npm pack --pack-destination=${packDir}`, {
    ...execArgs,
    cwd: path.join(__dirname, '..')
  }).finishedPromise
  return path.join(packDir, `nowprototypeit-${require('../package.json').version}.tgz`)
}

(async () => {
  const controlResults = {}
  await execv2(`npx nowprototypeit create --version=${npiVersionToCompare} --variant=@nowprototypeit/govuk-frontend-adaptor`, execArgs).finishedPromise
  await execv2(`npm install govuk-frontend@${govukFrontendVersion}`, execArgs).finishedPromise
  if (!skipPreBuilt) {
    await execv2('npx nowprototypeit build', execArgs).finishedPromise
    controlResults.preBuilt = await runPerformanceTest('serve-pre-built', numberOfRuns)
  }
  if (!skipServe) {
    controlResults.serve = await runPerformanceTest('serve', numberOfRuns)
  }
  if (!skipDev) {
    controlResults.dev = await runPerformanceTest('dev', numberOfDevRuns)
  }

  const dep = await packIfNeededAndGetDependencyIdentifier()

  rmSync(path.join(kitDir, '.tmp'), { recursive: true })
  await execv2('npm uninstall nowprototypeit', execArgs).finishedPromise
  await execv2(`npm install ${dep}`, execArgs).finishedPromise
  const actualResults = {}

  if (!skipPreBuilt) {
    await execv2('npx nowprototypeit build', execArgs).finishedPromise
    actualResults.preBuilt = await runPerformanceTest('serve-pre-built', numberOfRuns, Math.floor(controlResults.preBuilt / numberOfRuns))
  }
  if (!skipServe) {
    actualResults.serve = await runPerformanceTest('serve', numberOfRuns, Math.floor(controlResults.serve / numberOfRuns))
  }
  if (!skipDev) {
    actualResults.dev = await runPerformanceTest('dev', numberOfDevRuns, Math.floor(controlResults.dev / numberOfRuns))
  }
  console.log('control result', controlResults)
  console.log('actual result', actualResults)

  const failureReasons = []
  const successes = []

  console.log('')
  console.log('')
  console.log('')
  console.log(' - - - - - - - - - - - - - - - - - ')
  Object.keys(minimumAcceptablePercentageImprovements).forEach((key) => {
    if (!actualResults[key] && !controlResults[key]) {
      return
    }
    const percentageImprovement = ((controlResults[key] - actualResults[key]) / controlResults[key]) * 100
    const roundedPercentageImprovement = Math.round(percentageImprovement * 100) / 100
    if (percentageImprovement < minimumAcceptablePercentageImprovements[key]) {
      failureReasons.push(`${key}: Percentage improvement ${roundedPercentageImprovement}% improvement is below the minimum acceptable threshold of ${minimumAcceptablePercentageImprovements[key]}`)
    } else {
      successes.push(`${key}: Succeeded with a ${roundedPercentageImprovement}% improvement`)
    }
  })
  if (failureReasons.length > 0) {
    console.log('')
    console.log('Failures:')
    console.log('')
    failureReasons.forEach(x => console.log(x))
    console.log('')
  }
  if (successes.length > 0) {
    console.log('')
    console.log('Successes')
    console.log('')
    successes.forEach(x => console.log(x))
    console.log('')
  }
  console.log(' - - - - - - - - - - - - - - - - - ')
  console.log('')
  if (controlResults.serve && actualResults.preBuilt) {
    const amountFaster = Math.round(((controlResults.serve - actualResults.preBuilt) / controlResults.serve) * 10000) / 100
    console.log(`The most important metric in understanding the goal here - this version of pre-built-serve has a [${amountFaster}]% performance improvement over the baseline version (${npiVersionToCompare}) to run serve.`)
    console.log('')
    console.log("The pre-built-serve is designed for our dedicated hosting environment. Because we love open-source so it's available to anyone who wants to build their own custom hosted environment.")
    console.log('')
  }
  if (failureReasons.length > 0) {
    process.exit(1)
  }
})()
