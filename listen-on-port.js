const config = require('./lib/config.js').getConfig(null, false)
require('./lib/utils/replace-require').replaceRequire()
const server = require('./server.js')

if (config.isProduction) {
  server.listen(config.port)
  console.log(`Your prototype is running on port ${config.port}`)
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
