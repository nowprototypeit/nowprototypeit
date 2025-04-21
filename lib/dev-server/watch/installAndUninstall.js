const fsp = require('fs').promises
const path = require('path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')
const packageJsonPath = path.join(projectDir, 'package.json')
const packageJsonLockPath = path.join(projectDir, 'package-lock.json')
let ongoingUpdateMonitoringInterval
let latestActionedDependencyUpdateTime = 0

let isPaused = false
let lastUpdateTime = Date.now()

let emitChange = () => {
  events.emitExternal(eventTypes.PLUGIN_LIST_UPDATED)
  lastUpdateTime = Date.now()
}

let listener = async () => {
  if (isPaused) {
    return
  }
  emitChange()
}

events.on(eventTypes.PAUSE_DEPENDENCY_WATCHING, () => {
  console.log('pausing dependency watching')
  isPaused = true
})
events.on(eventTypes.RESUME_DEPENDENCY_WATCHING, async () => {
  console.log('resuming dependency watching')
  isPaused = false
})

async function setup (debounce) {
  emitChange = debounce(emitChange, 1000)
  listener = debounce(listener, 1000)

  watch([packageJsonPath, packageJsonLockPath], { allowGlobs: true })
    .on('change', async (filePath) => {
      const lastDependencyUpdateTime = await getLatestDependencyUpdateTime()
      if (lastDependencyUpdateTime === latestActionedDependencyUpdateTime) {
        return
      }

      latestActionedDependencyUpdateTime = lastDependencyUpdateTime

      if (!isPaused) {
        listener()
        startMonitoringForOngoingUpdates()
      }
    })
}

async function getLatestDependencyUpdateTime () {
  const packageJsonContents = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'))
  const pathsToPackageJsons = Object.keys(packageJsonContents.dependencies).map(dep => path.join(projectDir, 'node_modules', dep, 'package.json'))
  const lstats = await Promise.all(pathsToPackageJsons
    .map(async (filePath) => await fsp.lstat(filePath).catch(() => ({ mtimeMs: -1 }))))
  return lstats.map(({ mtimeMs }) => mtimeMs).reduce((acc, val) => Math.max(acc, val), -1)
}

function startMonitoringForOngoingUpdates () {
  if (ongoingUpdateMonitoringInterval) {
    clearInterval(ongoingUpdateMonitoringInterval)
  }
  ongoingUpdateMonitoringInterval = setInterval(async () => {
    if (lastUpdateTime < (Date.now() - 60000)) {
      clearInterval(ongoingUpdateMonitoringInterval)
    }
    const dependencyUpdateTime = await getLatestDependencyUpdateTime()
    if (dependencyUpdateTime > lastUpdateTime) {
      emitChange()
    }
  }, 2000)
}

module.exports = {
  setup
}
