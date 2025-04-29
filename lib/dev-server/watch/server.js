const managementPages = require('./managementPages')
const localPlugins = require('./localPlugins')
const installAndUninstall = require('./installAndUninstall')
const prototypeNode = require('./prototypeNode')
const prototypeNunjucks = require('./prototypeNunjucks')
const prototypeStyles = require('./prototypeStyles')
const prototypeConfig = require('./prototypeConfig')
const { debounce, monitorEventLoop } = require('../../utils')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { addShutdownFn, listenForShutdown } = require('../../utils/shutdownHandlers')

listenForShutdown()

monitorEventLoop('watcher')

;(async () => {
  await Promise.all([
    managementPages.setup(debounce, addShutdownFn),
    localPlugins.setup(debounce, addShutdownFn),
    installAndUninstall.setup(debounce, addShutdownFn),
    prototypeNode.setup(debounce, addShutdownFn),
    prototypeNunjucks.setup(debounce, addShutdownFn),
    prototypeStyles.setup(debounce, addShutdownFn),
    prototypeConfig.setup(debounce, addShutdownFn)
  ])
  events.emitExternal(eventTypes.RELOAD_PAGE)
})()
