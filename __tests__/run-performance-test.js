#!/usr/bin/env node

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

const numberOfRuns = Number(process.argv[2]) || 10
const numberOfDevRuns = Math.ceil(numberOfRuns / 5)
const npiVersionToCompare = '0.11.2'
const minimumAcceptablePercentageImprovements = {
  preBuilt: 35,
  serve: 2, // I'm not putting too much effort into this, just making sure it's not getting worse
  dev: 15
}
const packLocation = path.join(packDir, `nowprototypeit-${require('../package.json').version}.tgz`)

async function runPerformanceTest (command, numberOfRuns, benchmark = undefined) {
  const process = execv2(`${path.join(__dirname, 'single-performance-run.js')} ${kitDir} ${numberOfRuns} ${command}`, {
    ...execArgs,
    env: {
      ...(execArgs.env || {}),
      NPI_SERVE_PREBUILT_BENCHMARK_MS: benchmark
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

(async () => {
  const controlResults = {}
  await execv2(`npx nowprototypeit create --version=${npiVersionToCompare} --variant=@nowprototypeit/govuk-frontend-adaptor`, execArgs).finishedPromise
  await execv2('npx nowprototypeit build', execArgs).finishedPromise
  controlResults.preBuilt = await runPerformanceTest('serve-pre-built', numberOfRuns)
  controlResults.serve = await runPerformanceTest('serve', numberOfRuns)
  controlResults.dev = await runPerformanceTest('dev', numberOfDevRuns)

  await execv2(`npm pack --pack-destination=${packDir}`, {
    ...execArgs,
    cwd: path.join(__dirname, '..')
  }).finishedPromise

  await execv2('npm uninstall nowprototypeit', execArgs).finishedPromise
  await execv2(`npm install ${packLocation}`, execArgs).finishedPromise
  rmSync(path.join(kitDir, '.tmp'), { recursive: true })
  await execv2('npx nowprototypeit build', execArgs).finishedPromise
  console.log('Installed the new dependency')

  const actualResults = {}
  actualResults.preBuilt = await runPerformanceTest('serve-pre-built', numberOfRuns, Math.floor(controlResults.preBuilt / numberOfRuns))
  actualResults.serve = await runPerformanceTest('serve', numberOfRuns, Math.floor(controlResults.serve / numberOfRuns))
  actualResults.dev = await runPerformanceTest('dev', numberOfDevRuns, Math.floor(controlResults.dev / numberOfRuns))
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
