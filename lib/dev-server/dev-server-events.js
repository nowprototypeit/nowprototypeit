const EventEmitter = require('node:events')
const devServerEventTypes = require('./dev-server-event-types')
const { verboseLog } = require('../utils/verboseLogger')
const eventEmitter = new EventEmitter()

let alreadyListeningExternal = false

module.exports = {
  on: eventEmitter.on.bind(eventEmitter),
  once: eventEmitter.once.bind(eventEmitter),
  removeListener: eventEmitter.removeListener.bind(eventEmitter),
  emit: eventEmitter.emit.bind(eventEmitter),
  emitExternal: (type, obj = {}) => {
    if (!process.send) {
      return
    }
    if (!devServerEventTypes.all.includes(type)) {
      throw new Error(`Unknown event type [${type}]`)
    }
    try {
      process.send({ type, ...obj })
    } catch (e) {
      console.error(`Failed to send [${type}] event with content [${JSON.stringify(obj)}]`)
    }
  },
  listenExternal: ({ log = () => {} } = {}) => {
    if (alreadyListeningExternal) {
      verboseLog('already listening externally')
      return
    }
    alreadyListeningExternal = true
    // TODO: Decide whether to limit external event listening
    // const allowedMessageTypes = options.allowedEventTypes || allEventTypes
    verboseLog('setting up listener')
    process.on('message', (obj) => {
      log('received message', obj)
      if (obj && obj.type) {
        if (devServerEventTypes.all.includes(obj.type)) {
          const objToPassOn = { ...obj }
          delete objToPassOn.type
          eventEmitter.emit(obj.type, objToPassOn)
        } else {
          console.log('unexpected event', obj)
        }
      }
    })
  },
  getUniqueId: () => new Date().getTime() + '-' + ('' + Math.random()).split('.')[1]
}
