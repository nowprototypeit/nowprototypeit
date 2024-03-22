const EventEmitter = require('node:events')
const devServerEventTypes = require('./dev-server-event-types')
const allEventTypes = Object.keys(devServerEventTypes).map(key => devServerEventTypes[key])
const eventEmitter = new EventEmitter()

module.exports = {
  on: eventEmitter.on.bind(eventEmitter),
  once: eventEmitter.once.bind(eventEmitter),
  removeListener: eventEmitter.removeListener.bind(eventEmitter),
  emit: eventEmitter.emit.bind(eventEmitter),
  emitExternal: (type, obj = {}) => {
    if (!process.send) {
      return
    }
    if (!allEventTypes.includes(type)) {
      throw new Error(`Unknown event type [${type}]`)
    }
    try {
      process.send({ type, ...obj })
    } catch (e) {
      console.error(`Failed to send [${type}] event with content [${JSON.stringify(obj)}]`)
    }
  },
  listenExternal: (options = {}) => {
    // TODO: Decide whether to limit external event listening
    // const allowedMessageTypes = options.allowedEventTypes || allEventTypes
    process.on('message', (obj) => {
      if (obj && obj.type) {
        if (allEventTypes.includes(obj.type)) {
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
