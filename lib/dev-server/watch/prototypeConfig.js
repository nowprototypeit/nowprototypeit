const path = require('node:path')
const fsp = require('node:fs/promises')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')

const configPath = path.join(projectDir, 'app', 'config.json')
const initialConfig = require(configPath)
let lastKnownHostingEnabled = initialConfig.hostingEnabled
let lastKnownEditInBrowser = initialConfig.editInBrowser

async function setup () {
  const handler = async () => {
    events.emitExternal(eventTypes.REGENERATE_KIT_SASS)
    const { hostingEnabled, editInBrowser } = (await fsp.readFile(configPath, 'utf8').then(JSON.parse).catch(() => ({})))
    if (hostingEnabled !== lastKnownHostingEnabled || editInBrowser !== lastKnownEditInBrowser) {
      lastKnownHostingEnabled = hostingEnabled
      lastKnownEditInBrowser = editInBrowser
      events.emitExternal(eventTypes.MANAGEMENT_RESTART)
    }
  }
  watch(configPath, {})
    .on('add', handler)
    .on('change', handler)
    .on('unlink', handler)
}

module.exports = {
  setup
}
