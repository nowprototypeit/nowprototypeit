const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')
const { verboseLog } = require('../../utils/verboseLogger')

async function setup () {
  const watchRoot = path.join(projectDir, 'app', 'assets', 'sass')
  const whatToWatch = path.join(watchRoot, '**', '*.{scss,sass}')

  const handler = (filePath) => {
    verboseLog('SASS change detected in prototype styles watcher [%s]', filePath)
    events.emitExternal(eventTypes.REGENERATE_KIT_SASS)
  }
  watch(whatToWatch, {
    allowGlobs: true
  })
    .on('add', handler)
    .on('change', handler)
    .on('unlink', handler)
}

module.exports = {
  setup
}

setInterval(() => {
  verboseLog('SASS change watcher still running.')
}, 1000)
