// npm dependencies
const { spawn: crossSpawn } = require('cross-spawn')
const cp = require('node:child_process')
const eventTypes = require('./dev-server/dev-server-event-types')
const { addSpawnedProcessShutdownFn, removeSpawnedProcessShutdownFn } = require('./utils/shutdownHandlers')
const { verboseLog } = require('./utils/verboseLogger')

function marshallEvent (event, type) {
  return { ...event, type }
}

function splitCommand (commandToSplit) {
  if (typeof commandToSplit === 'string') {
    const parts = commandToSplit.split(' ')
    let command
    const args = []
    let a
    parts.forEach(commandPart => {
      if (!command) {
        command = commandPart
      } else if (a && commandPart.endsWith('"') && !commandPart.endsWith('\\"')) {
        a += ` ${commandPart}`
        args.push(a.slice(1, -1))
        a = undefined
      } else if (a) {
        a += ` ${commandPart}`
      } else if (commandPart.startsWith('"')) {
        a = commandPart
      } else {
        args.push(commandPart)
      }
    })
    return {
      command,
      args
    }
  } else if (commandToSplit && commandToSplit.command) {
    return commandToSplit
  } else {
    throw new Error('Invalid command for execv2, must be string or object with command property.')
  }
}

function execv2 (command, options = { passThroughEnv: true }) {
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })
  const commandParts = splitCommand(command)
  const spawnOptions = getStandardCpOptions(options)
  const process = cp.spawn(commandParts.command, commandParts.args, spawnOptions)
  addStdioHandlers(options, process)
  process.on('close', (code, signal) => {
    removeSpawnedProcessShutdownFn(simpleExitHandler)
    if (code) {
      if (!options.neverRejectFinishedPromise) {
        finishedRej(new Error(`exec failed with code [${code}] and signal [${signal}], command was [${JSON.stringify(command)}]`))
      }
    } else {
      finishedRes()
    }
  })

  const exit = async (maxWaitTime = 10000) => {
    if (process) {
      process.kill('SIGTERM')
    }
    const start = Date.now()
    if (process) {
      while (!process.killed && Date.now() - start < maxWaitTime) {
        console.log('waiting for process to exit')
        await sleep(100)
      }
      if (!process.killed) {
        throw new Error(`Process did not exit after ${maxWaitTime / 1000} seconds, gave up waiting`)
      }
    }
  }
  const simpleExitHandler = async () => {
    await exit(1000)
    await finishedPromise
  }
  addSpawnedProcessShutdownFn(simpleExitHandler)
  return {
    finishedPromise,
    stdio: {
      stderr: process.stderr,
      stdout: process.stdout,
      stdin: process.stdin
    },
    exit
  }
}

function getStandardCpOptions (options = { passThroughEnv: true }) {
  const env = { ...(options.passThroughEnv ? process.env : { VERBOSE: process.env.VERBOSE }), ...(options.env || {}) }
  const cpOptions = {
    env,
    stdio: options.stdio || 'pipe'
  }
  if (options.cwd) {
    cpOptions.cwd = options.cwd
  }
  return cpOptions
}

function addStdioHandlers (options, forked) {
  if (!options.hideStdio && options?.stdio !== 'inherit') {
    if (!options.hideStdout) {
      forked.stdout.pipe(process.stdout)
    }
    if (!options.hideStderr) {
      forked.stderr.pipe(process.stderr)
    }
  }

  if (options.stdoutHandlers) {
    Object.keys(options.stdoutHandlers).forEach(key => {
      forked.stdout.on(key, options.stdoutHandlers[key])
    })
  }
}

function fork (command, options) {
  let isOpen
  let closeCalled = false
  let stderr = ''
  let finalStderr = ''
  let skipCloseEvent = false
  let finishedRes, finishedRej
  let respectsShutdownIpcEvent = false
  const forkId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })
  const forkArgs = [command]
  if (options.args) {
    forkArgs.push(options.args)
  }
  if (options.eventEmitter && !options.passOnEvents?.includes(eventTypes.SHUTDOWN)) {
    throw new Error('You must pass on SHUTDOWN event to forked process')
  }
  forkArgs.push(getStandardCpOptions(options))
  const forked = cp.fork(...forkArgs)
  const startTime = Date.now()
  const pid = forked.pid
  isOpen = true
  const eventListenersToCleanUp = []

  function cleanUpEventListeners () {
    while (eventListenersToCleanUp.length > 0) {
      const { type, fn } = eventListenersToCleanUp.pop()
      options.eventEmitter.removeListener(type, fn)
    }
  }

  function addEventListener (type, fn) {
    if (!options.eventEmitter) {
      return
    }
    eventListenersToCleanUp.push({ type, fn })
    options.eventEmitter.on(type, fn)
  }

  const listener = obj => {
    if (obj.type === eventTypes.PROCESS_SUPPORTS_NPI_IPC_SHUTDOWN_V1) {
      verboseLog('Forked process supports NPI IPC shutdown v1', pid, command, forkId)
      respectsShutdownIpcEvent = true
      forked.off('message', listener)
    }
  }
  forked.on('message', listener)

  if (options.eventEmitter) {
    forked.on('message', obj => {
      const objToPassOn = { ...obj }
      delete objToPassOn.type
      options.eventEmitter.emit(obj.type || eventTypes.UNKNOWN, objToPassOn)
    })
  }

  addStdioHandlers(options, forked)

  if (forked.stderr) {
    forked.stderr.on('data', (data) => {
      finalStderr = data.toString()
      stderr += finalStderr
    })
  }

  function emitCloseEvent (args) {
    if (options.eventEmitter && options.closeEvent && !skipCloseEvent) {
      options.eventEmitter.emit(options.closeEvent, args)
    }
  }

  let expectExitCode1OnWindows = false

  function codeIsAcceptable (code) {
    if (code === 0) {
      return true
    }
    if (process.platform === 'win32' && expectExitCode1OnWindows && code === 1) {
      return true
    }
    return false
  }

  const spawnStack = new Error('Detecting Spawn Stack').stack

  forked.on(eventTypes.PROCESS_SUPPORTS_NPI_IPC_SHUTDOWN_V1, () => {
    verboseLog('Forked process supports NPI IPC shutdown v1', pid, command, forkId)
    respectsShutdownIpcEvent = true
  })

  forked.on('close', (code, signal) => {
    verboseLog(`Forked process close event [${pid}] [${command}] [${forkId}]`)
    isOpen = false
    cleanUpEventListeners()
    const closeEventInfo = {
      code,
      signal,
      stderr,
      finalStderr
    }
    if (options.includeRunningTimeOnCloseEvent) {
      closeEventInfo.timeRunning = Date.now() - startTime
    }
    verboseLog(`Forked process close event [${pid}] [${command}] [${forkId}]`)
    emitCloseEvent(closeEventInfo)
    if (!codeIsAcceptable(code)) {
      verboseLog(`close condition a [${pid}] [${command}] [${forkId}]`)
      const fullCommand = [command, ...(options.args || [])].join(' ')
      if (options.neverRejectFinishedPromise) {
        verboseLog(`close condition a.2 [${pid}] [${command}] [${forkId}]`)
        finishedRes()
        return
      }
      verboseLog('Forked process failure was spawned at stack', spawnStack)
      if (closeCalled) {
        console.warn(`Fork errored while closing, this might be a symptom of an underlying problem pid [${pid}] command [${command}] forkId [${forkId}]`)
        finishedRes()
      } else {
        finishedRej(new Error(`Fork failed with code [${code}] and signal [${signal}], command was [${fullCommand}], fork ID was [${forkId}]`))
      }
    } else {
      verboseLog(`close condition b [${pid}] [${command}] [${forkId}]`)
      finishedRes()
    }
  })
  if (options.eventEmitter && options.passOnEvents) {
    const arr = options.passOnEvents.map ? [...options.passOnEvents] : [options.passOnEvents]
    arr.forEach(type => {
      addEventListener(type, event => {
        if (isOpen) {
          try {
            forked.send(marshallEvent(event, type))
          } catch (e) {
            verboseLog('Failed to send event to forked process', e)
          }
        }
      })
    })
  }

  let shutdownErrorHandlerSetup = false

  function sendShutdownEvent () {
    if (!shutdownErrorHandlerSetup) {
      shutdownErrorHandlerSetup = true
      forked.on('error', (err) => {
        verboseLog('Attempting forced kill command [%s], forkId [%s]', command, forkId)
        verboseLog('Forked process error', err)
        try {
          forked.kill('SIGKILL')
        } catch (e) {
          verboseLog('Failed send SIGKILL to process command [%s], pid [%s], forkId [%s], error [%s]', command, pid, forkId, e)
        }
      })
    }
    try {
      if (forked.channel && respectsShutdownIpcEvent) {
        verboseLog('Fork accepts shutdown event')
        forked.send(marshallEvent({}, eventTypes.SHUTDOWN))
      } else if (!forked.killed) {
        verboseLog('Forked process does not have a channel, cannot send shutdown event, sending kill instead')
        process.kill(forked.pid, 'SIGTERM')
      } else {
        verboseLog('Forked process is already killed', command, pid)
      }
    } catch (e) {
      verboseLog('Failed to send shutdown event', e)
    }
  }

  const ipcClose = async ({ skipForkCloseEvent = false } = {}) => {
    verboseLog(`close (ipc) [${pid}] [${command}]`)
    if (isOpen) {
      verboseLog(`is still open (ipc) [${pid}] [${command}]`)
      cleanUpEventListeners()
      if (skipForkCloseEvent) {
        skipCloseEvent = true
      }
      sendShutdownEvent()
    }
    await finishedPromise
    removeSpawnedProcessShutdownFn(simpleCloseHandler)

    verboseLog(`close i [${pid}] [${command}]`)
  }
  const nonIpcClose = async ({ skipForkCloseEvent = false } = {}) => {
    verboseLog(`close (non-ipc) [${pid}] [${command}]`)
    if (isOpen) {
      verboseLog(`is still open (non-ipc) [${pid}] [${command}]`)
      cleanUpEventListeners()
      if (skipForkCloseEvent) {
        skipCloseEvent = true
      }
      verboseLog('nonIpcClose, killing process', command, pid)
      try {
        verboseLog('nonIpcClose, sending SIGINT', command, pid)
        expectExitCode1OnWindows = true
        process.kill(forked.pid, 'SIGINT')
      } catch (e) {
        verboseLog('nonIpcClose, Failed to kill process', command, pid, e)
      }
    }
    // eslint-disable-next-line no-unmodified-loop-condition
    while (isOpen) {
      verboseLog('Process still open, waiting', command, pid)
      await sleep(100)
    }
    removeSpawnedProcessShutdownFn(simpleCloseHandler)
  }
  const close = async ({ skipForkCloseEvent = false } = {}) => {
    closeCalled = true
    verboseLog('Close called for process [%s] with pid [%s]', command, pid)
    if (!isOpen) {
      verboseLog('Forked process is already closed', command, pid)
      return
    }
    if (forked.channel && respectsShutdownIpcEvent) {
      verboseLog('Fork accepts shutdown event')
      verboseLog('Forked process is IPC, using IPC close', command, pid)
      return await ipcClose({ skipForkCloseEvent })
    }
    verboseLog('Forked process is not IPC, using non IPC close', command, pid)
    return await nonIpcClose({ skipForkCloseEvent })
  }
  const simpleCloseHandler = async () => {
    await close()
  }
  simpleCloseHandler.metadata = {
    type: 'fork',
    pid,
    command,
    args: options.args
  }
  addSpawnedProcessShutdownFn(simpleCloseHandler)
  return {
    close,
    forciblyKill: async () => {
      if (forked) {
        try {
          process.kill(forked.pid, 0)
          verboseLog(`Attempting to exit process ${forked.pid} with SIGKILL`)
          forked.kill('SIGKILL')
          await finishedPromise
        } catch (err) {
          if (err.code === 'ESRCH') {
            verboseLog(`Process ${forked.pid} does not exist (may already be terminated).`)
            finishedRes()
          } else {
            console.error(`Failed to exit process ${forked.pid}:`, err)
          }
        }
      } else {
        verboseLog('Process is already closed or does not exist.')
      }

      try {
        process.kill(forked.pid, 0)
        console.log(`Process is still running, we've tried everything [${forked.pid}]`)
      } catch (err) {
        if (err.code === 'ESRCH') {
          console.log(`Process ${forked.pid} successfully terminated.`)
        } else {
          console.error(`Unexpected error while checking process ${forked.pid}:`, err)
        }
      }
    },
    emit: (type, event) => {
      forked.send(marshallEvent(event, type))
    },
    stdio: {
      stderr: forked.stderr,
      stdout: forked.stdout,
      stdin: forked.stdin
    },
    finishedPromise,
    forkId,
    pid
  }
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

function exec (command, options = {}, stdout, stderr) {
  const errorOutput = []
  const child = crossSpawn(command, [], { shell: true, ...options })

  addStdoutAndStderrHandlers(child, stdout, stderr, errorOutput)

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        const error = new Error(`Exit code was [${code}] for command [${command}]`)
        error.code = code
        if (errorOutput.length > 0) {
          error.errorOutput = errorOutput.join('\n')
        }
        reject(error)
      }
    })
  })
}

function spawn (command, args, options = {}, stdout, stderr) {
  const child = crossSpawn(command, args, { ...options })

  addStdoutAndStderrHandlers(child, stdout, stderr, [])

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        const fullCommand = [command, ...args].join(' ')
        const err = new Error(`Exit code was ${code}, command was ${fullCommand}`)
        console.log('stack')
        console.log(err.stack)
        reject(err)
      }
    })
  })
}

module.exports = {
  exec,
  spawn,
  fork,
  execv2
}

function addStdoutAndStderrHandlers (child, stdout, stderr, errorOutput) {
  if (child.stdout) {
    child.stdout.on('data', (data) => {
      if (stdout) {
        stdout(data)
      }
    })
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => {
      if (stderr) {
        stderr(data)
      }
      errorOutput.push(data)
    })
  }
}
