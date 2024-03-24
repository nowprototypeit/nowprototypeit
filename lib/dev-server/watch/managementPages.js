const chokidar = require('chokidar')
const path = require('node:path')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { generateManagePrototypeCssIfNecessary, kitDependencyIsInDevelopment } = require('../manage-prototype/build')
const { projectDir } = require('../../utils/paths')

module.exports = { setup }
async function setup (debounce) {
  const pathToModule = path.join(projectDir, 'node_modules', 'nowprototypeit')

  const restartManagePrototype = debounce(() => {
    events.emitExternal(eventTypes.MANAGEMENT_RESTART)
    events.emitExternal(eventTypes.TRIGGER_WATCHER_RESTART)
  })
  if (await kitDependencyIsInDevelopment()) {
    chokidar.watch(path.join(pathToModule, 'lib', 'dev-server', '**', '*'), {
      ignoreInitial: true
    })
      .on('all', async (event, path) => {
        if (path.endsWith('.js')) {
          restartManagePrototype()
        } else if (path.endsWith('.scss')) {
          await generateManagePrototypeCssIfNecessary()
          restartManagePrototype()
        } else if (path.endsWith('.njk')) {
          restartManagePrototype()
        }
      })
  }
}
