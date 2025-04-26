const startTime = Date.now()
global.logTimeFromStart = process.env.LOG_SERVE_PREBUILT_PERFORMANCE === 'true'
  ? function (message) {
    const time = Date.now() - startTime
    console.log(`[perf] [${time}]ms [${message}]`)
  }
  : () => {}

require('./dev-server').runDevServer()
