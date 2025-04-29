#!/usr/bin/env node

const { existsSync } = require('fs')
const path = require('path')
const { execv2 } = require('../lib/exec')
const { findAvailablePortWithoutUser } = require('../features/step-definitions/utils.js')

const prototypeDir = process.argv[2]
const numberOfRuns = Number(process.argv[3])
const command = process.argv[4]

if (!existsSync(prototypeDir)) {
  console.error('Failed to find prototype dir', prototypeDir)
  process.exit(1)
}
const script = path.join(prototypeDir, 'node_modules', '.bin', 'nowprototypeit')

if (!existsSync(script)) {
  console.error('Failed to find script', script)
  process.exit(1)
}

if (isNaN(numberOfRuns)) {
  console.error('Expected number of runs to be a number')
  process.exit(1)
}

if (!command) {
  console.error('Command required (e.g. serve, dev, serve-pre-built)', process.argv)
  process.exit(1)
}

const benchmark = Number(process.env.NPI_PERF_BENCHMARK_MS)

const reportsToHandle = []

async function runReport ({ port }) {
  const logLines = []
  const startHrTime = process.hrtime.bigint()
  let endHrTime
  const result = execv2(`${script} ${command}`, {
    passThroughEnv: true,
    hideStdio: process.env.SHOW_KIT_STDIO !== 'true',
    cwd: prototypeDir,
    env: {
      PORT: port,
      LOG_SERVE_PREBUILT_PERFORMANCE: 'true'
    }
  })

  result.stdio.stderr.on('data', async (data) => {
    logLines.push(data.toString())
  })

  result.stdio.stdout.on('data', async (data) => {
    const log = data.toString()
    let triggerExit = false
    log.split('\n').forEach((log) => {
      if (log.includes('Your prototype is running on port') || log.includes('The Prototype Kit is now running at')) {
        endHrTime = process.hrtime.bigint()
        triggerExit = true
        logLines.push(log)
      } else if (log.startsWith('[perf]')) {
        reportsToHandle.push(log)
      } else {
        logLines.push(log)
      }
    })
    if (triggerExit) {
      await result.exit()
    }
  })

  await result.finishedPromise
  return {
    time: Number((endHrTime - startHrTime) / BigInt(1000000)),
    logs: logLines.filter(x => x).join('\n')
  }
}

function errorTimeout (ms) {
  let resolve = () => {}
  const promise = new Promise((_resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, ms)
    resolve = () => {
      clearTimeout(timeout)
      _resolve()
    }
  })
  return {
    promise,
    abandon: () => {
      resolve()
    }
  }
}

async function runReportAndWait () {
  const portToUse = await findAvailablePortWithoutUser()
  const resultsFromEachRun = []
  for (let i = 0; i < numberOfRuns; i++) {
    console.log('Remaining: ', numberOfRuns - i)
    const timeout = errorTimeout(15000)
    resultsFromEachRun.push(await Promise.race([
      runReport({ port: portToUse }),
      timeout.promise
    ]))
    timeout.abandon()
  }
  return resultsFromEachRun
}

function prepareReport () {
  return reportsToHandle.reduce((accum, report) => {
    const reportParts = report.split('[').map(x => x.split(']')[0])
    const timeInMs = Number(reportParts[2])
    const message = reportParts[3]
    const foundIndex = accum.findIndex(x => x.message === message)
    if (foundIndex > -1) {
      const found = accum[foundIndex]
      found.all.push(timeInMs)
    } else {
      accum.push({
        message,
        all: [timeInMs]
      })
    }
    return accum
  }, []).map(x => ({
    message: x.message,
    mean: x.all.reduce((accum, x) => accum + x, 0) / x.all.length,
    nintythPercentile: x.all.sort((a, b) => a - b)[Math.floor(x.all.length * 0.9)],
    median: x.all.sort((a, b) => a - b)[Math.floor(x.all.length / 2)]
  })).toSorted((x, y) => x.avg < y.avg).map(display).join('\n')
}

function display ({ message, mean, median, nintythPercentile }) {
  const parts = ['', message]
  parts.push(`mean: [${mean}]ms`)
  parts.push(`median: [${median}]ms`)
  parts.push(`90th percentile: [${nintythPercentile}]ms`)
  return parts.join('\n')
}

function errorIfLogLinesDidNotMatch (logLinesFromEachRun) {
  const summary = logLinesFromEachRun.reduce((accum, logLines) => {
    if (!accum[logLines]) {
      accum[logLines] = 0
    }
    accum[logLines]++
    return accum
  }, {})
  if (Object.keys(summary).length === 1) {
    console.log('All runs matched')
  } else {
    console.log('Log lines from test runs did not match each other')
    console.log('Divergences were:')
    const output = Object.keys(summary).map((key) => ({
      count: summary[key],
      lines: key
    })).map(({ count, lines }) => `${count} runs matched:\n\n${lines}`)
    console.log(['', ...output, ''].join('\n\n - - - - \n\n'))
    throw new Error('Log lines did not match.')
  }
}

runReportAndWait().then((resultsFromEachRun) => {
  const timesFromEachRun = resultsFromEachRun.map(x => x.time)
  const timeTaken = timesFromEachRun.reduce((accum, x) => accum + x, 0)
  const average = timeTaken / timesFromEachRun.length
  const nintythPercentile = timesFromEachRun.sort((a, b) => a - b)[Math.floor(timesFromEachRun.length * 0.9)]
  console.log(prepareReport())
  console.log()
  const benchmarkSummary = benchmark ? ` ... ${(Math.round((((benchmark - average) / benchmark)) * 100))}% improvement from benchmark` : ''
  console.log(`Total time: [${timeTaken}]ms for [${numberOfRuns}] runs ([${average}]ms per run average${benchmarkSummary} and 90th percentile [${nintythPercentile}]ms for command [${command}]`)
  errorIfLogLinesDidNotMatch(resultsFromEachRun.map(x => x.logs))
})
