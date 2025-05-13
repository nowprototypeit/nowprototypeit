const eventTypes = require('../dev-server/dev-server-event-types')
const events = require('../dev-server/dev-server-events')
const { verboseLog } = require('./verboseLogger')
let name = JSON.stringify(process.argv)
const shutdownFns = []
const spawnedProcessShutdownFns = []

async function cleanoutListOfFns (fns) {
  while (fns.length) {
    const fn = fns.pop() || function () { /* just in case */ }
    try {
      await fn()
    } catch (e) {
      console.error('Error during shutdown', e)
    }
  }
}

const runShutdownFunctions = async () => {
  verboseLog(`Running shutdown functions for [${name}]`, process.pid)
  do {
    await cleanoutListOfFns(spawnedProcessShutdownFns)
    await cleanoutListOfFns(shutdownFns)
  } while (spawnedProcessShutdownFns.length || shutdownFns.length)
  verboseLog(`Shutdown functions complete for [${name}]`, process.pid)
}

async function shutdown (processEntryPointName, statusCode = 0) {
  verboseLog(`Shutting down [${processEntryPointName || name}] ([${process.pid}]) ...`)
  await runShutdownFunctions()
  verboseLog(`Shutdown of [${processEntryPointName || name}] ([${process.pid}]) complete.`)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, 1000)
  })
  verboseLog('Shutting down with status code [%s] for process [%s] with pid [%s]}', statusCode, processEntryPointName, process.pid, new Error().stack)
  process.exit(statusCode)
}

let listenOnShutdownAlreadyRun = false

function listenForShutdown (processEntryPointName) {
  if (listenOnShutdownAlreadyRun) {
    console.warn('listenForShutdown already run, ignoring')
    return
  }
  listenOnShutdownAlreadyRun = true
  name = processEntryPointName
  events.listenExternal({ log: verboseLog })
  events.once(eventTypes.SHUTDOWN, async (info) => {
    verboseLog('Process [%s] with pid [%s] received shutdown with info [%s]', processEntryPointName, process.pid, info)
    await shutdown(processEntryPointName)
  })
  process.on('disconnect', () => {
    verboseLog('Received disconnect, exiting', processEntryPointName, process.pid)
    process.exit()
  })
  process.on('SIGINT', async () => {
    verboseLog('Received SIGINT, exiting', processEntryPointName, process.pid)
    await shutdown(processEntryPointName)
  })
  events.emitExternal(eventTypes.PROCESS_SUPPORTS_NPI_IPC_SHUTDOWN_V1)
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

function addSpawnedProcessShutdownFn (fn) {
  spawnedProcessShutdownFns.push(fn)
}

function removeSpawnedProcessShutdownFn (fn) {
  const index = spawnedProcessShutdownFns.indexOf(fn)
  if (index > -1) {
    spawnedProcessShutdownFns.splice(index, 1)
  }
}

module.exports = {
  addShutdownFn,
  removeShutdownFn,
  listenForShutdown,
  runShutdownFunctions,
  shutdown,
  addSpawnedProcessShutdownFn,
  removeSpawnedProcessShutdownFn
}
