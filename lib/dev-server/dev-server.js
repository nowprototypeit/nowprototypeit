// node dependencies
const path = require('path')

// npm dependencies
const chokidar = require('chokidar')
const fse = require('fs-extra')
const events = require('./dev-server-events')
const eventTypes = require('./dev-server-event-types')
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')

const {
  generateAssetsSync,
  generateCssSync,
  proxyUserSassIfItExists, generateNunjucksSync
} = require('../build')
const utils = require('../utils')
const { fork } = require('../exec')
const {
  appSassDir,

  publicCssDir
} = require('../utils/paths')
const { verboseLog } = require('../utils/verboseLogger')
const { setupCommandHandler } = require('./commands')
const { runSequentially, monitorEventLoop } = require('../utils')
let repeatKitStatusEvent = () => {}
let kitSuccessfullyStarted = false

monitorEventLoop('dev-server')

const kitStartTimer = startPerformanceTimer()
events.once(eventTypes.KIT_STARTED, () => {
  endPerformanceTimer('kitStart', kitStartTimer)
})

events.on(eventTypes.KIT_STARTED, (info) => {
  kitSuccessfullyStarted = true
  if (info.port) {
    repeatKitStatusEvent = () => {
      events.emit(eventTypes.KIT_STARTED, info)
    }
  }
  events.emit(eventTypes.RELOAD_PAGE)
})

events.on(eventTypes.KIT_STOPPED, (info) => {
  if (info.code !== null && info.code !== 0) {
    repeatKitStatusEvent = () => {
      events.emit(eventTypes.KIT_STOPPED, info)
    }
    console.log(`Kit stopped after running for [${info.timeRunning}ms]`)
    if (kitSuccessfullyStarted) {
      kitSuccessfullyStarted = false
      console.log('restarting kit as it broke')
      startKit()
    }
  }
})

const commands = {
  rs: () => {
    events.emit(eventTypes.TRIGGER_KIT_RESTART)
    events.emit(eventTypes.MANAGEMENT_RESTART)
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

function startManagement (port) {
  return new Promise((resolve) => {
    const managementFork = fork(`${path.join(__dirname, 'manage-prototype', 'manage-prototype-runner.js')}`, {
      env: {
        PORT: port
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
        eventTypes.KIT_SASS_ERROR
      ]
    })
    repeatKitStatusEvent()
    events.once(eventTypes.MANAGEMENT_STARTED, () => {
      resolve(managementFork)
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
        eventTypes.TEMPLATE_PREVIEW_REQUEST
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
    includeRunningTimeOnCloseEvent: true
  })
}

// Build watch and serve
async function runDevServer () {
  const port = await (new Promise((resolve) => utils.findAvailablePort(resolve)))
  let managementFork = await startManagement(port)
  let watcherFork = startWatcher()
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
      generateAssetsSync()
      generateCssSync()
      await utils.waitUntilFileExists(path.join(publicCssDir, 'application.css'), 5000)
    } catch (err) {
      await handleError(err)
    }
  }

  await buildKitAssets(handleError)

  kitFork = await startKit()
  watchAfterStarting()

  events.on(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART, runSequentially(async function () {
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
    generateNunjucksSync()
    events.emit(eventTypes.TRIGGER_KIT_RESTART)
  }))

  events.on(eventTypes.TRIGGER_KIT_RESTART, runSequentially(async function () {
    const previousKitFork = kitFork
    kitFork = await startKit().catch(() => {})
    if (previousKitFork) {
      await previousKitFork.close(true)
    }
  }))

  events.on(eventTypes.TRIGGER_WATCHER_RESTART, runSequentially(async function () {
    const previousWatcherFork = watcherFork
    if (previousWatcherFork) {
      await previousWatcherFork.close(true)
    }
    watcherFork = startWatcher()
    console.log('Watcher restarted.')
  }))

  events.on(eventTypes.PLUGIN_LIST_UPDATED, () => {
    events.emit(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART)
  })

  events.on(eventTypes.MANAGEMENT_STOPPED, (info) => {
    verboseLog(`Management stopped with code ${info.code}`)
  })

  setupCommandHandler()
}

function proxyAndGenerateCssSync (fullFilename, state) {
  const filename = fullFilename.split(path.sep).pop().toLowerCase()
  if (filename === 'settings.scss') {
    proxyUserSassIfItExists(filename)
    generateCssSync(state)
  }
}

function watchSass (sassPath) {
  if (!fse.existsSync(sassPath)) {
    return
  }
  chokidar.watch(sassPath, {
    ignoreInitial: true,
    awaitWriteFinish: true,
    disableGlobbing: true // Prevents square brackets from being mistaken for globbing characters
  }).on('add', proxyAndGenerateCssSync)
    .on('unlink', proxyAndGenerateCssSync)
    .on('all', () => {
      generateCssSync()
    })
}

function watchAfterStarting () {
  watchSass(appSassDir)
}

module.exports = {
  runDevServer
}
