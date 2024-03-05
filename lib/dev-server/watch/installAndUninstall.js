const fsp = require('fs').promises
const path = require('path')
const { projectDir } = require('../../utils/paths')
const events = require('../dev-server-events')
const eventTypes = require('../dev-server-event-types')
const { watch } = require('./utils')
const packageJsonPath = path.join(projectDir, 'package.json')

let isPaused = false
let lastKnownDependencyList = []

events.on(eventTypes.PAUSE_DEPENDENCY_WATCHING, () => {
  isPaused = true
})
events.on(eventTypes.RESUME_DEPENDENCY_WATCHING, async () => {
  lastKnownDependencyList = await getDependencyList()
  isPaused = false
})

async function getDependencyList () {
  const jsonFile = await fsp.readFile(packageJsonPath, 'utf8')
  return Object.keys(JSON.parse(jsonFile).dependencies)
}

async function setup (debounce) {
  watch(packageJsonPath, { allowGlobs: false })
    .on('change', debounce(async () => {
      if (isPaused) {
        return
      }
      try {
        const dependencyList = await getDependencyList(packageJsonPath)
        if (dependencyList.join('____') !== lastKnownDependencyList.join('____')) {
          lastKnownDependencyList = dependencyList
          console.log('dependency update detected.')
          events.emit(eventTypes.PLUGIN_LIST_UPDATED)
        }
      } catch (e) {
        console.log(e)
      }
    }))
}

module.exports = {
  setup
}
