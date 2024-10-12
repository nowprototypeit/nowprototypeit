const events = require('./dev-server-events')
const eventTypes = require('./dev-server-event-types')
const { exec } = require('../exec')
const path = require('node:path')
const fsp = require('node:fs').promises
const { projectDir } = require('../utils/paths')

const lastKnownStateById = {}

async function captureNpiDependency () {
  return await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8')
    .then(JSON.parse)
    .then((packageJson) => {
    return packageJson.dependencies && packageJson.dependencies.nowprototypeit
  })
}

function getEntrypointAndVersionFromNPIPackageJson () {
  return fsp.readFile(path.join(projectDir, 'package.json'), 'utf8').then((data) => {
    JSON.parse(data)
  }).then((packageJson) => {
    return {
      entryPoint: packageJson._cliDevEntryPoint,
      version: packageJson.version
    }
  })
}

module.exports = {
  setupCommandHandler: () => {
    events.on(eventTypes.MANAGEMENT_COMMAND_REQUEST, async (info) => {
      const npiDependencyBeforeCommand = await captureNpiDependency()
      events.emit(eventTypes.PAUSE_DEPENDENCY_WATCHING)

      function sendUpdate (restarting, completed, success = undefined) {
        const obj = {
          id: info.id,
          updatedDate: Date.now(),
          completed,
          restarting,
          started: true
        }
        if (success !== undefined) {
          obj.success = success
        }
        events.emit(eventTypes.MANAGEMENT_COMMAND_UPDATE, obj)
        lastKnownStateById[obj.id] = obj
      }

      sendUpdate(false, false)
      exec(info.command)
        .then(captureNpiDependency)
        .then((npiDependencyAfterCommand) => {

          sendUpdate(true, false)
          if (npiDependencyBeforeCommand !== npiDependencyAfterCommand) {
            getEntrypointAndVersionFromNPIPackageJson().then(info => {
              events.emitExternal(eventTypes.FULL_KIT_RESTART, {
                message: `Restarting your prototype to start using version ${info.version} of Now Prototype It...`,
                entryPoint: info.entryPoint
              })
            }).catch(() => {
              events.emitExternal(eventTypes.FULL_KIT_STOP, {
                message: `Stopping your prototype after kit update.  Please try to run the kit again`
              })
            })
          } else {
            events.once(eventTypes.KIT_STARTED, () => {
              sendUpdate(true, true, true)
            })
            events.emit(eventTypes.PLUGIN_LIST_UPDATED)
            events.emit(eventTypes.RESUME_DEPENDENCY_WATCHING)
          }
        }).catch((e) => {
        console.log('Caught error', e)
        sendUpdate(false, true, false)
        events.emit(eventTypes.RESUME_DEPENDENCY_WATCHING)
      })
    })

    events.on(eventTypes.MANAGEMENT_COMMAND_UPDATE_REQUEST, (info) => {
      const { id, updatedSince } = info
      const lastKnown = lastKnownStateById[id]
      if (!lastKnown) {
        return
      }
      if (lastKnown.updatedDate < updatedSince) {
        return
      }
      events.emit(eventTypes.MANAGEMENT_COMMAND_UPDATE, lastKnown)
    })
  }
}
