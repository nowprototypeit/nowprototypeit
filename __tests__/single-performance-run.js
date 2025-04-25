#!/usr/bin/env node

const { existsSync } = require('fs')
const path = require('path')
const { execv2 } = require('../lib/exec')

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

async function runReport () {
  const result = execv2(`${script} ${command}`, {
    passThroughEnv: true,
    hideStdio: process.env.SHOW_KIT_STDIO !== 'true',
    env: {
      PORT: 0,
      LOG_SERVE_PREBUILT_PERFORMANCE: 'true'
    }
  })

  result.stdio.stdout.on('data', async (data) => {
    const log = data.toString()
    if (log.includes('Your prototype is running on port') || log.includes('The Prototype Kit is now running at')) {
      await result.exit()
    }
    if (log.startsWith('[perf]')) {
      reportsToHandle.push(log)
    }
  })

  await result.finishedPromise
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
  for (let i = 0; i < numberOfRuns; i++) {
    console.log('Remaining: ', numberOfRuns - i)
    const timeout = errorTimeout(15000)
    await Promise.race([
      runReport(),
      timeout.promise
    ])
    timeout.abandon()
  }
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

const startTime = Date.now()
runReportAndWait().then(() => {
  const timeTaken = Date.now() - startTime
  console.log(prepareReport())
  console.log()
  const average = timeTaken / numberOfRuns
  const benchmarkSummary = benchmark ? ` ... ${(Math.round((((benchmark-average) / benchmark)) * 100))}% improvement from benchmark` : ''
  console.log(`Total time: [${timeTaken}]ms for [${numberOfRuns}] runs ([${average}]ms per run average${benchmarkSummary} for command [${command}]`)
})
