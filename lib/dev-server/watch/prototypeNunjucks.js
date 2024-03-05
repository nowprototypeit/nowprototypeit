const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')

async function setup () {
  const watchRoot = path.join(projectDir, 'app')
  const whatToWatch = path.join(watchRoot, '**', '*.{njk,html}')

  const handler = () => {
    events.emit(eventTypes.RELOAD_PAGE)
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
