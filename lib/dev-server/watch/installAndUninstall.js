const fsp = require('fs').promises
const path = require('path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')
const { verboseLog } = require('../../utils/verboseLogger')
const packageJsonPath = path.join(projectDir, 'package.json')
const packageJsonLockPath = path.join(projectDir, 'package-lock.json')
let ongoingUpdateMonitoringInterval
let latestActionedDependencyUpdateTime = 0

let isPaused = false
let lastUpdateTime = Date.now()

const emitChange = () => {
  events.emitExternal(eventTypes.PLUGIN_LIST_UPDATED)
  lastUpdateTime = Date.now()
}

const listener = async () => {
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

async function setup (debounce, registerCloseFn) {
  const debouncedEmitChange = debounce(emitChange, 1000)
  const debouncedListener = debounce(listener, 1000)

  watch([packageJsonPath, packageJsonLockPath], { registerCloseFn })
    .on('change', async () => {
      const lastDependencyUpdateTime = await getLatestDependencyUpdateTime()
      if (lastDependencyUpdateTime === latestActionedDependencyUpdateTime) {
        return
      }

      latestActionedDependencyUpdateTime = lastDependencyUpdateTime

      if (!isPaused) {
        debouncedListener()
        startMonitoringForOngoingUpdates(debouncedEmitChange)
      }
    })
}

async function getPackageJsonContents () {
  let result
  let remainingRetries = 5
  while (!result && remainingRetries-- > 0) {
    try {
      result = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'))
    } catch (e) {
      verboseLog('Failed to read package.json, retrying in 100ms')
      await new Promise(resolve => setTimeout(resolve, 100))
      remainingRetries--
    }
  }
  return result
}

async function getLatestDependencyUpdateTime () {
  const packageJsonContents = await getPackageJsonContents()
  if (packageJsonContents === undefined) {
    verboseLog('Failed to read package.json, returning -1')
    return -1
  }
  const pathsToPackageJsons = Object.keys(packageJsonContents.dependencies).map(dep => path.join(projectDir, 'node_modules', dep, 'package.json'))
  const lstats = await Promise.all(pathsToPackageJsons
    .map(async (filePath) => await fsp.lstat(filePath).catch(() => ({ mtimeMs: -1 }))))
  return lstats.map(({ mtimeMs }) => mtimeMs).reduce((acc, val) => Math.max(acc, val), -1)
}

function startMonitoringForOngoingUpdates (debouncedEmitChange) {
  if (ongoingUpdateMonitoringInterval) {
    clearInterval(ongoingUpdateMonitoringInterval)
  }
  ongoingUpdateMonitoringInterval = setInterval(async () => {
    if (lastUpdateTime < (Date.now() - 60000)) {
      clearInterval(ongoingUpdateMonitoringInterval)
    }
    const dependencyUpdateTime = await getLatestDependencyUpdateTime()
    if (dependencyUpdateTime > lastUpdateTime) {
      debouncedEmitChange()
    }
  }, 2000)
}

module.exports = {
  setup
}
