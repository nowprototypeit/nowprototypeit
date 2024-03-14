const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')

async function setup () {
  const handler = () => {
    events.emit(eventTypes.REGENERATE_KIT_SASS)
    events.emit(eventTypes.MANAGEMENT_RESTART)
  }
  watch(path.join(path.join(projectDir, 'app', 'config.json')), {
    allowGlobs: false
  })
    .on('add', handler)
    .on('change', handler)
    .on('unlink', handler)
}

module.exports = {
  setup
}
