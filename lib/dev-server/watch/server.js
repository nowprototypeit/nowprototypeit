const managementPages = require('./managementPages')
const localPlugins = require('./localPlugins')
const installAndUninstall = require('./installAndUninstall')
const prototypeNode = require('./prototypeNode')
const prototypeNunjucks = require('./prototypeNunjucks')
const prototypeStyles = require('./prototypeStyles')
const prototypeConfig = require('./prototypeConfig')
const { debounce, monitorEventLoop } = require('../../utils')

;(async () => {
  await Promise.all([
    managementPages.setup(debounce),
    localPlugins.setup(debounce),
    installAndUninstall.setup(debounce),
    prototypeNode.setup(debounce),
    prototypeNunjucks.setup(debounce),
    prototypeStyles.setup(debounce),
    prototypeConfig.setup(debounce)
  ])
})()

monitorEventLoop('watcher')
