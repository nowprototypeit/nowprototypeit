const events = require('./dev-server-events')
const eventTypes = require('./dev-server-event-types')
const { exec } = require('../exec')
const path = require('node:path')
const fsp = require('node:fs').promises
const { projectDir, packageDir, tmpDir } = require('../utils/paths')
const kitVersion = require('../../package.json').version

const pathToShareInfoAfterRestart = path.join(tmpDir, 'commandInfoAfterRestart.json')
const lastKnownStateById = {}

async function captureNpiDependency () {
  return await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8')
    .then(JSON.parse)
    .then((packageJson) => {
      return packageJson.dependencies && packageJson.dependencies.nowprototypeit
    })
}

function getEntrypointAndVersionFromNPIPackageJson () {
  return fsp.readFile(path.join(packageDir, 'package.json'), 'utf8')
    .then(JSON.parse)
    .then(packageJson => ({
      entryPoint: packageJson._cliDevEntryPoint,
      version: packageJson.version
    }))
}

function setCommandIdsResolvedByRestart (ids) {
  return fsp.writeFile(pathToShareInfoAfterRestart, JSON.stringify({
    kitVersion,
    ids
  }))
}

function getCommandIdsResolvedByRestart () {
  return fsp.readFile(pathToShareInfoAfterRestart, 'utf8')
    .then(JSON.parse)
    .then(info => info.ids)
    .then(async ids => {
      await fsp.rm(pathToShareInfoAfterRestart)
      return ids
    })
    .catch(() => [])
}

function sendUpdate (id, restarting, completed, success = undefined) {
  const obj = {
    id,
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

module.exports = {
  setupCommandHandler: () => {
    getCommandIdsResolvedByRestart()
      .then(ids => {
        ids.forEach(id => {
          sendUpdate(id, true, true, true)
        })
      })
      .catch(e => {
        console.log('Failed to send successes after restart', e)
      })
    events.on(eventTypes.MANAGEMENT_COMMAND_REQUEST, async (info) => {
      const npiDependencyBeforeCommand = await captureNpiDependency()
      events.emit(eventTypes.PAUSE_DEPENDENCY_WATCHING)

      const id = info.id

      sendUpdate(id, false, false)
      exec(info.command)
        .then(captureNpiDependency)
        .then((npiDependencyAfterCommand) => {
          sendUpdate(id, true, false)
          console.log('before', npiDependencyBeforeCommand)
          console.log('after', npiDependencyAfterCommand)
          if (npiDependencyBeforeCommand !== npiDependencyAfterCommand) {
            getEntrypointAndVersionFromNPIPackageJson()
              .then(async info => {
                await setCommandIdsResolvedByRestart([id])
                console.log('FKR Trigger')
                events.emitExternal(eventTypes.FULL_KIT_RESTART, {
                  message: `Restarting your prototype to start using version ${info.version} of Now Prototype It...`,
                  entryPoint: info.entryPoint
                })
              })
              .catch(async (e) => {
                await setCommandIdsResolvedByRestart([id])
                console.log('catch a - error', e)
                events.emitExternal(eventTypes.FULL_KIT_STOP, {
                  message: 'Stopping your prototype after kit update.  Please try to run the kit again'
                })
              })
          } else {
            events.once(eventTypes.KIT_STARTED, () => {
              sendUpdate(id, true, true, true)
            })
            events.emit(eventTypes.PLUGIN_LIST_UPDATED)
            events.emit(eventTypes.RESUME_DEPENDENCY_WATCHING)
          }
        })
        .catch((e) => {
          console.log('Caught error', e)
          sendUpdate(false, true, false)
          events.emit(eventTypes.RESUME_DEPENDENCY_WATCHING)
        })
    })

    events.on(eventTypes.MANAGEMENT_COMMAND_UPDATE_REQUEST, (info) => {
      const { id, updatedSince } = info
      const lastKnown = lastKnownStateById[id]
      if (!lastKnown) {
        // TODO: Decide what to do with unknown commands
        return
      }
      if (lastKnown.updatedDate < updatedSince) {
        return
      }
      events.emit(eventTypes.MANAGEMENT_COMMAND_UPDATE, lastKnown)
    })
  }
}
