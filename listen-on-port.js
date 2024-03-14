process.on('disconnect', () => {
  process.exit()
})

// npm dependencies
const config = require('./lib/config.js').getConfig(null, false)
const server = require('./server.js')
const events = require('./lib/dev-server/dev-server-events')
const eventTypes = require('./lib/dev-server/dev-server-event-types')
const { monitorEventLoop } = require('./lib/utils')

monitorEventLoop('prototype')

if (config.isProduction) {
  server.listen(config.port)
  console.log('Your prototype is running on port', config.port)
} else {
  const listener = server.listen(() => {
    events.emitExternal(eventTypes.KIT_STARTED, {
      port: listener.address().port
    })
  })
}
