// node dependencies
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')
const fullFile = startPerformanceTimer()

const path = require('path')
// npm dependencies
const events = require('./dev-server-events')
const eventTypes = require('./dev-server-event-types')

const {
  generateAssets,
  generateNunjucksSync
} = require('../build')
const utils = require('../utils')
const { fork } = require('../exec')
const {
  publicCssDir
} = require('../utils/paths')
const { verboseLog } = require('../utils/verboseLogger')
const { setupCommandHandler } = require('./commands')
const { runSequentially, monitorEventLoop } = require('../utils')
let repeatKitStatusEvent = () => {}
let kitSuccessfullyStarted = false

monitorEventLoop('dev-server')

events.listenExternal()

events.on(eventTypes.FULL_KIT_RESTART, (message) => {
  events.emitExternal(eventTypes.FULL_KIT_RESTART, message)
})

const kitStartTimer = startPerformanceTimer()
events.once(eventTypes.KIT_STARTED, () => {
  endPerformanceTimer('kitStart', kitStartTimer)
})

events.on(eventTypes.KIT_STARTED, (info) => {
  kitSuccessfullyStarted = true
  if (info.port) {
    repeatKitStatusEvent = () => {
      events.emit(eventTypes.KIT_STARTED, { ...info, isRepeat: true })
    }
  }
  events.emit(eventTypes.RELOAD_PAGE)
})

events.on(eventTypes.KIT_STOPPED, async (info) => {
  if (info.code !== null && info.code !== 0) {
    repeatKitStatusEvent = () => {
      events.emit(eventTypes.KIT_STOPPED, { info, isRepeat: true })
    }
    console.log(`Kit stopped after running for [${info.timeRunning}ms]`)
    if (kitSuccessfullyStarted) {
      kitSuccessfullyStarted = false
      console.log('restarting kit as it broke')
      await startKit()
    }
  }
})

const commands = {
  rs: () => {
    events.emit(eventTypes.TRIGGER_KIT_RESTART)
    events.emit(eventTypes.MANAGEMENT_RESTART)
  },
  'full-rs': () => {
    events.emit(eventTypes.FULL_KIT_RESTART)
  },
  'rs kit': () => {
    events.emit(eventTypes.TRIGGER_KIT_RESTART)
  },
  'rs management': () => {
    events.emit(eventTypes.MANAGEMENT_RESTART)
  },
  'rs man': () => {
    events.emit(eventTypes.MANAGEMENT_RESTART)
  },
  'reload page': () => {
    events.emit(eventTypes.RELOAD_PAGE)
  },
  'rs watch': () => {
    events.emit(eventTypes.TRIGGER_WATCHER_RESTART)
  },
  stop: () => {
    events.emitExternal(eventTypes.SHUTDOWN)
  },
  exit: () => {
    events.emitExternal(eventTypes.SHUTDOWN)
  }
}
process.stdin.on('data', (data) => {
  const command = data.toString().trim().toLowerCase()
  if (commands[command]) {
    commands[command]()
  } else if (command.startsWith('fire')) {
    try {
      const [type, ...objParts] = data.toString().trim().split(' ').slice(1)
      const obj = JSON.parse(objParts.join(' ') || '{}')
      if (eventTypes[type]) {
        console.log('Fired event [%s] with [%s]', type, obj)
        events.emit(type, obj)
      } else {
        console.log('Unknown event type [%s]', type)
      }
    } catch (e) {
      console.error('Failed to process fire request')
      console.error(e)
    }
  }
})

let kitStartLogged = false

function startManagement (port) {
  return new Promise((resolve) => {
    const managementFork = fork(`${path.join(__dirname, 'manage-prototype', 'manage-prototype-runner.js')}`, {
      env: {
        PORT: port,
        ALREADY_LOGGED_KIT_STARTED: kitStartLogged ? 'true' : 'false'
      },
      passThroughEnv: true,
      neverRejectFinishedPromise: true,
      eventEmitter: events,
      closeEvent: eventTypes.MANAGEMENT_STOPPED,
      passOnEvents: [
        eventTypes.KIT_STARTED,
        eventTypes.KIT_STOPPED,
        eventTypes.KIT_SASS_REGENERATED,
        eventTypes.TEMPLATE_PREVIEW_RESPONSE,
        eventTypes.MANAGEMENT_COMMAND_UPDATE,
        eventTypes.PLUGIN_LIST_UPDATED,
        eventTypes.RELOAD_PAGE,
        eventTypes.KIT_SASS_ERROR,
        eventTypes.SHUTDOWN
      ]
    })
    events.once(eventTypes.MANAGEMENT_STARTED, () => {
      resolve(managementFork)
    })
    events.once(eventTypes.MANAGEMENT_STARTED, () => {
      repeatKitStatusEvent()
    })
    events.once(eventTypes.KIT_START_LOGGED, () => {
      kitStartLogged = true
    })
  })
}

function startKit () {
  return new Promise((resolve) => {
    const kitFork = fork(`${path.join(__dirname, '..', '..', 'listen-on-port.js')}`, {
      eventEmitter: events,
      closeEvent: eventTypes.KIT_STOPPED,
      neverRejectFinishedPromise: true,
      passOnEvents: [
        eventTypes.TEMPLATE_PREVIEW_REQUEST,
        eventTypes.SHUTDOWN
      ],
      includeRunningTimeOnCloseEvent: true
    })
    const resolver = () => {
      resolve(kitFork)
      events.removeListener(eventTypes.KIT_STARTED, resolver)
      events.removeListener(eventTypes.KIT_STOPPED, resolver)
    }
    events.on(eventTypes.KIT_STARTED, resolver)
    events.on(eventTypes.KIT_STOPPED, resolver)
  })
}

function startWatcher () {
  return fork(`${path.join(__dirname, 'watch', 'server.js')}`, {
    eventEmitter: events,
    closeEvent: eventTypes.WATCHER_STOPPED,
    neverRejectFinishedPromise: true,
    includeRunningTimeOnCloseEvent: true,
    passOnEvents: [eventTypes.SHUTDOWN]
  })
}

// Build watch and serve
async function runDevServer () {
  global.logTimeFromStart('runDevServer start')
  const portPromise = new Promise((resolve) => utils.findAvailablePortWithUser(resolve))
  await buildKitAssets(handleError)
  const port = await portPromise
  let [managementFork, watcherFork] = await Promise.all([
    startManagement(port),
    startWatcher()
  ])
  let kitFork

  events.on(eventTypes.MANAGEMENT_RESTART, runSequentially(async () => {
    await managementFork.close()
    managementFork = await startManagement(port)
    console.log('Prototype Management app restarted.')
  }))

  function handleError (err) {
    console.error(err)
    process.exit(1)
  }

  async function buildKitAssets (handleError) {
    try {
      await Promise.all([
        generateAssets()
      ])
      await utils.waitUntilFileExists(path.join(publicCssDir, 'application.css'), 5000)
    } catch (err) {
      await handleError(err)
    }
  }

  let kitForkPromise = startKit()

  events.on(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART, runSequentially(async function () {
    await kitForkPromise
    let error
    await buildKitAssets((err) => {
      error = err
      console.error('Failed to rebuild kit assets', err)
    })
    if (!error) {
      events.emit(eventTypes.TRIGGER_KIT_RESTART)
    }
  }))

  events.on(eventTypes.TRIGGER_NUNJUCKS_REBUILD_AND_RESTART, runSequentially(async function () {
    await kitForkPromise
    generateNunjucksSync()
    events.emit(eventTypes.TRIGGER_KIT_RESTART)
  }))

  events.on(eventTypes.TRIGGER_KIT_RESTART, runSequentially(async function () {
    await kitForkPromise
    kitFork.close()
    kitForkPromise = startKit().catch(() => {})
    kitFork = await kitForkPromise
  }))

  events.on(eventTypes.TRIGGER_WATCHER_RESTART, runSequentially(async function () {
    await kitForkPromise
    const previousWatcherFork = watcherFork
    if (previousWatcherFork) {
      await previousWatcherFork.close(true)
    }
    watcherFork = startWatcher()
    console.log('Watcher restarted.')
  }))

  events.on(eventTypes.PLUGIN_LIST_UPDATED, async () => {
    await kitForkPromise
    events.emit(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART)
  })

  events.on(eventTypes.MANAGEMENT_STOPPED, (info) => {
    verboseLog(`Management stopped with code ${info.code}`)
  })

  kitFork = await kitForkPromise
  kitForkPromise = undefined
  setupCommandHandler()
  global.logTimeFromStart('runDevServer end')
}

module.exports = {
  runDevServer
}
endPerformanceTimer('fullFile dev-server.js', fullFile)
