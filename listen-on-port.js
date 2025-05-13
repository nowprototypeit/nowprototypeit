global.logTimeFromStart = global.logTimeFromStart || function () {}
const { listenForShutdown } = require('./lib/utils/shutdownHandlers')
listenForShutdown('listen-on-port')
global.logTimeFromStart('listening for shutdown')
const config = require('./lib/config.js').getConfig(null, false)
global.logTimeFromStart('config loaded')
require('./lib/utils/replace-require').replaceRequire()
global.logTimeFromStart('require replaced')
const server = require('./server.js')

global.logTimeFromStart('all dependencies loaded')

if (config.isProduction) {
  const handler = server.listen(config.port, () => {
    global.logTimeFromStart('listening')
    console.log(`Your prototype is running on port ${handler.address().port}`)
  })
} else {
  process.on('disconnect', () => {
    process.exit()
  })

  const events = require('./lib/dev-server/dev-server-events')
  const eventTypes = require('./lib/dev-server/dev-server-event-types')
  const { monitorEventLoop } = require('./lib/utils')

  monitorEventLoop('prototype')
  const listener = server.listen(() => {
    events.emitExternal(eventTypes.KIT_STARTED, {
      port: listener.address().port
    })
  })
}
