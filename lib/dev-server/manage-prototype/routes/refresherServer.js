const events = require('../../dev-server-events')
const eventTypes = require('../../dev-server-event-types')

const currentListeners = []

setInterval(() => {
  while (currentListeners.length > 3) {
    currentListeners.shift()(false, 750)
  }
}, 250)

events.on(eventTypes.RELOAD_PAGE, () => {
  while (currentListeners.length > 0) {
    currentListeners.shift()(true, 500)
  }
})

module.exports = {
  refresherServer: (app, config) => {
    app.get('/manage-prototype/reload-trigger', (req, res, next) => {
      function sendResponse (shouldReload, nextCheckInMilliseconds) {
        res.send({ shouldReload, lastReload: config.lastReload, nextCheckInMilliseconds })
      }

      if (req.query.lastReload && Number(req.query.lastReload) < config.lastReload) {
        sendResponse(true)
      } else {
        currentListeners.push(sendResponse)
      }
    })
  }
}
