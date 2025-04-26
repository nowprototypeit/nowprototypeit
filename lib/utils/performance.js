const perfConfig = {
  logPerformance: process.env.LOG_PERFORMANCE === 'true',
  logPerformanceSummary: Number(process.env.LOG_PERFORMANCE_SUMMARY),
  logPerformanceMatching: process.env.LOG_PERFORMANCE_MATCHING
}

const noopFn = () => {
}
const performanceLog = []
const logPerformanceMatching = perfConfig.logPerformanceMatching && perfConfig.logPerformanceMatching.split(',')

const startPerformanceTimerFn = () => process.hrtime()

const endPerformanceTimerFn = (name, timer) => {
  const hrTime = process.hrtime(timer)
  const timeTaken = (hrTime[0] * 1000000 + hrTime[1] / 1000) / 1000
  addToSummary(name, timeTaken)
  logPerformance(name, timeTaken)
}
const addToSummaryFn = (name, timeTaken) => performanceLog.push({ name, timeTaken })

const logMatchingOutcomesOnly = (name, timeTaken) => {
  if (logPerformanceMatching.find(str => name.includes(str))) {
    console.log('[perf] [%s]ms [%s]', timeTaken, name)
  }
}

const logAllOutcomes = (name, timeTaken) => {
  console.log('[perf] [%s]ms [%s]', timeTaken, name)
}

const chooseOutcomeLogger = () => logPerformanceMatching ? logMatchingOutcomesOnly : logAllOutcomes

const logPerformanceSummaryFn = () => {
  const summary = {}
  const output = {}
  performanceLog.forEach(({ name, timeTaken }) => {
    const obj = summary[name] = summary[name] || { total: 0, count: 0 }
    obj.total += timeTaken
    obj.count++
  })
  Object.keys(summary).forEach((name) => {
    const item = summary[name]
    output[name] = {
      'Average (ms)': (Math.round((item.total / item.count) * 100) / 100),
      Count: item.count
    }
  })
  console.log('Performance summary:')
  console.log('')
  console.table(output)
}

const logPerformance = perfConfig.logPerformance ? chooseOutcomeLogger() : noopFn
const addToSummary = perfConfig.logPerformanceSummary ? addToSummaryFn : noopFn
const logPerformanceSummaryOnce = perfConfig.logPerformanceSummary ? logPerformanceSummaryFn : noopFn

let isSummaryLogStarted = false
if (perfConfig.logPerformanceSummary && !isSummaryLogStarted) {
  isSummaryLogStarted = true
  setInterval(logPerformanceSummaryOnce, perfConfig.logPerformanceSummary)
}

module.exports = {
  startPerformanceTimer: perfConfig.logPerformance || perfConfig.logPerformanceSummary ? startPerformanceTimerFn : noopFn,
  endPerformanceTimer: perfConfig.logPerformance || perfConfig.logPerformanceSummary ? endPerformanceTimerFn : noopFn,
  logPerformanceSummaryOnce
}
