const fsp = require('node:fs').promises
const path = require('node:path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const config = require('../../config')
const { recursiveDirectoryContentsSync, sleep } = require('../../utils')
let lastUpdated = new Date()
let previousContentsLength = 0
const standardDelay = 50
const shortDelay = 10

function reload () {
  lastUpdated = Date.now()
  events.emitExternal(eventTypes.RELOAD_PAGE)
}

async function setup () {
  const check = async () => {
    const rootDir = path.join(projectDir, 'app', 'views')
    const contents = recursiveDirectoryContentsSync(rootDir)
      .filter(x => x.endsWith('.njk') || x.endsWith('.html') || (config.getConfig().respectFileExtensions && x.endsWith('.md')))
      .map((file) => path.join(rootDir, file))

    if (previousContentsLength !== contents.length) {
      previousContentsLength = contents.length
      reload()
      setTimeout(check, standardDelay)
      return
    }

    const fns = contents.map((file) => ({
      fn: () => {
        return fsp.lstat(file).catch(() => ({ mtime: new Date(0) }))
      },
      file
    }))

    while (fns.length) {
      const details = fns.pop()
      const stats = await details.fn()
      if (stats.mtime > lastUpdated) {
        reload()
        setTimeout(check, standardDelay)
        return
      }
      await sleep(shortDelay)
    }

    setTimeout(check, standardDelay)
  }

  check()
}

module.exports = {
  setup
}
