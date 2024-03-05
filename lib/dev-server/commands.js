const events = require('./dev-server-events')
const eventTypes = require('./dev-server-event-types')
const { exec } = require('../exec')

const lastKnownStateById = {}

module.exports = {
  setupCommandHandler: () => {
    events.on(eventTypes.MANAGEMENT_COMMAND_REQUEST, async (info) => {
      console.log('command request received', info)
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
      exec(info.command).then(() => {
        sendUpdate(true, false)
        events.once(eventTypes.KIT_STARTED, () => {
          sendUpdate(true, true, true)
        })
        events.emit(eventTypes.PLUGIN_LIST_UPDATED)
        events.emit(eventTypes.RESUME_DEPENDENCY_WATCHING)
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
