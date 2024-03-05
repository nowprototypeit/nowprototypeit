const events = require('../../../dev-server-events')
const eventTypes = require('../../../dev-server-event-types')
const { contextPath, pluginLogger } = require('../../utils')

const knownHistoryByCommandId = {}
const updateListenersByCommandId = {}
const requestCountPerId = {}

function sendInfoToListeners (listeners, info) {
  if (listeners) {
    while (listeners.length > 0) {
      listeners.pop()(info)
    }
  }
}

events.on(eventTypes.MANAGEMENT_COMMAND_UPDATE, (info) => {
  knownHistoryByCommandId[info.id] = info
  pluginLogger('Received info', JSON.stringify(info))
  sendInfoToListeners(updateListenersByCommandId[info.id], info)
})

function queueCommand (command) {
  pluginLogger('command queued', command)
  const id = events.getUniqueId()
  const info = knownHistoryByCommandId[id] = {
    id,
    started: false,
    updatedDate: Date.now() - 100
  }
  info.nextUrl = getNextUrl(id, info)
  updateListenersByCommandId[id] = []
  requestCountPerId[id] = 0
  events.emitExternal(eventTypes.MANAGEMENT_COMMAND_REQUEST, {
    id,
    command
  })
  return info
}

function getNextUrl (id, info) {
  return `${contextPath}/command/${encodeURIComponent(id)}/progress?updatedSince=${info.updatedDate}`
}

function updateAlreadyKnown (id, updatedSince) {
  return knownHistoryByCommandId[id] && (!updatedSince || knownHistoryByCommandId[id].updatedDate > updatedSince)
}

function setupPluginRoutes (router) {
  router.get('/command/:commandId/progress', (req, res) => {
    const id = req.params.commandId
    const { updatedSince } = req.query

    const triggerUpdate = setTimeout(() => {
      pluginLogger('Triggering update after delay')
      events.emitExternal(eventTypes.MANAGEMENT_COMMAND_UPDATE_REQUEST, {
        id,
        updatedSince
      })
    }, 1500)

    const sendInfo = (info) => {
      clearTimeout(triggerUpdate)
      const result = {
        ...info
      }
      if (!info.completed) {
        result.nextUrl = getNextUrl(id, info)
      }
      res.send(result)
    }

    if (updateAlreadyKnown(id, updatedSince)) {
      pluginLogger('sending already known info', id)
      sendInfo(knownHistoryByCommandId[id])
    } else {
      pluginLogger('adding listenerByCommandId', id)
      updateListenersByCommandId[id].push(sendInfo)
    }
  })
}

module.exports = {
  queueCommand,
  setupPluginRoutes
}
