const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')

async function setup () {
  const watchRoot = path.join(projectDir, 'app', 'assets', 'sass')
  const whatToWatch = path.join(watchRoot, '**', '*.{scss,sass}')

  const handler = (filePath) => {
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
