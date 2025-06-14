const path = require('path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')

async function setup () {
  const watchRoot = path.join(projectDir, 'app')

  const handler = (filePath) => {
    const relativePath = path.relative(watchRoot, filePath)
    if (!relativePath.startsWith('assets' + path.sep)) {
      events.emitExternal(eventTypes.TRIGGER_KIT_RESTART)
    }
  }
  watch(watchRoot, {
    recursive: true,
    fileExtensions: ['js', 'json']
  })
    .on('add', handler)
    .on('change', handler)
    .on('unlink', handler)
}

module.exports = {
  setup
}
