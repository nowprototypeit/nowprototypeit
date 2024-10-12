const fsp = require('node:fs').promises
const fs = require('node:fs')
const path = require('node:path')
const { persistenceDir } = require('../utils/paths')

const preloadedStates = {}

module.exports = {
  setupPersistenceSync,
  external: {
    useStore
  }
}

function useStore (storeName) {
  const store = preloadedStates[storeName] || {}
  monitorStore(storeName, store).then(() => {})
  return store
}

async function monitorStore (storeName, store) {
  let lastKnownState = JSON.stringify(store)
  await checkForUpdates()
  async function checkForUpdates () {
    const currentState = JSON.stringify(store)
    if (currentState !== lastKnownState) {
      await fsp.writeFile(path.join(persistenceDir, `${storeName}.json`), currentState)
      lastKnownState = currentState
    }
    setTimeout(checkForUpdates, 500)
  }
}

function setupPersistenceSync () {
  fs.mkdirSync(persistenceDir, { recursive: true })
  const files = fs.readdirSync(persistenceDir).filter(file => file.endsWith('.json'))
  for (const file of files) {
    const storeName = file.replace(/\.json$/, '')
    let parsedJson = {}
    try {
      parsedJson = JSON.parse(fs.readFileSync(path.join(persistenceDir, file), 'utf8'))
    } catch (e) {}
    preloadedStates[storeName] = parsedJson
  }
}
