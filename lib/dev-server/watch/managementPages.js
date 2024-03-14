const chokidar = require('chokidar')
const path = require('path')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { generateManagePrototypeCssIfNecessary, kitDependencyIsInDevelopment } = require('../manage-prototype/build')

module.exports = { setup }
async function setup (debounce) {
  const pathToModule = path.join(process.cwd(), 'node_modules', '@nowprototypeit', 'govuk')

  const restartManagePrototype = debounce(() => {
    events.emit(eventTypes.MANAGEMENT_RESTART)
  })
  if (await kitDependencyIsInDevelopment()) {
    chokidar.watch(path.join(pathToModule, '**', '*'), {
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
