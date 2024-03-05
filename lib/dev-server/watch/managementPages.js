const chokidar = require('chokidar')
const path = require('path')
const fsp = require('node:fs').promises
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { generateManagePrototypeCss } = require('../../build')

module.exports = { setup }

async function setup (debounce) {
  const pathToModule = path.join(process.cwd(), 'node_modules', '@nowprototypeit', 'govuk')
  const lstat = await fsp.lstat(pathToModule).catch(e => ({ isSymbolicLink: () => false }))
  const restartManagePrototype = debounce(() => {
    events.emit(eventTypes.MANAGEMENT_RESTART)
  })

  if (lstat.isSymbolicLink()) {
    chokidar.watch(path.join(pathToModule, '**', '*'), {
      ignoreInitial: true
    })
      .on('all', async (event, path) => {
        if (path.endsWith('.js')) {
          restartManagePrototype()
        } else if (path.endsWith('.scss')) {
          await generateManagePrototypeCss()
          restartManagePrototype()
        } else if (path.endsWith('.njk')) {
          restartManagePrototype()
        }
      })
  }
}
