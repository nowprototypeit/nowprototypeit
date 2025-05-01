const eventTypes = require('../dev-server/dev-server-event-types')
const events = require('../dev-server/dev-server-events')
const { verboseLog } = require('./verboseLogger')

const shutdownFns = []

const runShutdownFunctions = async () => {
  verboseLog('Received shutdown signal', process.pid)
  while (shutdownFns.length) {
    verboseLog(`Running shutdown function, [${shutdownFns.length}] remaining for pid [${process.pid})`)
    const fn = shutdownFns.pop()
    try {
      await fn()
    } catch (e) {
      console.error('Error during shutdown', e)
    }
  }
  process.exit(0)
}

function listenForShutdown () {
  events.listenExternal({ log: console.log })
  events.on(eventTypes.SHUTDOWN, runShutdownFunctions)
  verboseLog('listening to shutdown', process.pid)
}

function addShutdownFn (fn) {
  shutdownFns.push(fn)
}
function removeShutdownFn (fn) {
  const index = shutdownFns.indexOf(fn)
  if (index > -1) {
    shutdownFns.splice(index, 1)
  }
}

module.exports = {
  addShutdownFn,
  removeShutdownFn,
  listenForShutdown,
  runShutdownFunctions
}
