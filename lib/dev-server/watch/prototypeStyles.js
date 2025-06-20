const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')
const { verboseLog } = require('../../utils/verboseLogger')

async function setup () {
  const watchRoot = path.join(projectDir, 'app', 'assets', 'sass')

  const handler = (filePath) => {
    verboseLog('SASS change detected in prototype styles watcher [%s]', filePath)
    events.emitExternal(eventTypes.REGENERATE_KIT_SASS)
  }
  watch(watchRoot, {
    recursive: true,
    fileExtensions: ['scss', 'sass']
  })
    .on('add', handler)
    .on('change', handler)
    .on('unlink', handler)
}

module.exports = {
  setup
}
