const chokidar = require('chokidar')
const path = require('path')
const fsp = require('node:fs').promises
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { projectDir } = require('../../utils/paths')

module.exports = { setup }

async function setup (debounce) {
  const packageJsonContents = await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8')
  const dependencies = JSON.parse(packageJsonContents).dependencies
  const dependenciesToWatch = Object.keys(dependencies).map((key) => {
    const isFileDependency = dependencies[key].startsWith('file:')
    return isFileDependency && key !== 'nowprototypeit'
      ? {
          name: key,
          dir: dependencies[key].split('file:')[1]
        }
      : null
  }).filter(x => x !== null)
  await Promise.all(dependenciesToWatch.map(async (dependency) => {
    const pathToModule = path.join(projectDir, 'node_modules', dependency.name)
    const lstat = await fsp.lstat(pathToModule).catch(e => ({ isSymbolicLink: () => false }))
    const rebuildAndRestartKit = debounce(() => {
      events.emitExternal(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART)
    })
    const rebuildNunjucksAndRestartKit = debounce(() => {
      events.emitExternal(eventTypes.TRIGGER_NUNJUCKS_REBUILD_AND_RESTART)
    })

    if (lstat.isSymbolicLink()) {
      chokidar.watch(path.join(pathToModule, '**', '*'), {
        ignoreInitial: true
      })
        .on('all', async (event, path) => {
          if (path.endsWith('.js') || path.endsWith('.json')) {
            rebuildAndRestartKit()
          } else if (path.endsWith('.njk') || path.endsWith('.html')) {
            rebuildNunjucksAndRestartKit()
          } else if (path.endsWith('.scss')) {
            events.emitExternal(eventTypes.REGENERATE_KIT_SASS)
          }
        })
    }
  }))
}
