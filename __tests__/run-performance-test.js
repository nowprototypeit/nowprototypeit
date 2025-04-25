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
const numberOfDevRuns = Math.ceil(numberOfRuns / 5)
const npiVersionToCompare = '0.11.2'
const minimumAcceptablePercentageImprovements = {
  preBuilt: underpowered ? 30 : 35,
  serve: -3, // As we improve the other two, this should not get worse - if it is completely unchanged then there will be natural variation between runs.  I'm seeing a range between -3% and +3% on a laptop
  dev: underpowered ? 30 : 35 // We're seeing much bigger improvements in the range of 15% on a reasonably powerful laptop, this benchmark needs to run on GitHub default workers where there's less power and we don't see as much of an improvement
}
async function runPerformanceTest (command, numberOfRuns, benchmark = undefined) {
  const process = execv2(`${path.join(__dirname, 'single-performance-run.js')} ${kitDir} ${numberOfRuns} ${command}`, {
    ...execArgs,
    env: {
      ...(execArgs.env || {}),
      NPI_PERF_BENCHMARK_MS: benchmark
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

async function packIfNeededAndGetDependencyIdentifier() {
  if (depToTest) {
    return depToTest
  }
  await execv2(`npm pack --pack-destination=${packDir}`, {
    ...execArgs,
    cwd: path.join(__dirname, '..')
  }).finishedPromise
  return path.join(packDir, `nowprototypeit-${require('../package.json').version}.tgz`);
}

(async () => {
  const controlResults = {}
  await execv2(`npx nowprototypeit create --version=${npiVersionToCompare} --variant=@nowprototypeit/govuk-frontend-adaptor`, execArgs).finishedPromise
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

  const dep = await packIfNeededAndGetDependencyIdentifier();

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
  if (failureReasons.length > 0) {
    process.exit(1)
  }
})()
