// npm dependencies
const { spawn: crossSpawn } = require('cross-spawn')
const cp = require('node:child_process')
const eventTypes = require('./dev-server/dev-server-event-types')

function marshallEvent (event, type) {
  return { ...event, type }
}

function fork (command, options) {
  let isOpen
  let stderr = ''
  let finalStderr = ''
  let skipCloseEvent = false
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })
  const env = { ...(options.passThroughEnv ? process.env : {}), ...(options.env || {}) }
  const forkArgs = [command]
  if (options.args) {
    forkArgs.push(options.args)
  }
  const forkOptions = {
    env,
    stdio: 'pipe'
  }
  if (options.cwd) {
    forkOptions.cwd = options.cwd
  }
  forkArgs.push(forkOptions)
  const forked = cp.fork(...forkArgs)
  const startTime = Date.now()
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

  if (options.eventEmitter) {
    forked.on('message', obj => {
      const objToPassOn = { ...obj }
      delete objToPassOn.type
      options.eventEmitter.emit(obj.type || eventTypes.UNKNOWN, objToPassOn)
    })
  }

  if (!options.hideStdio) {
    if (!options.hideStdout) {
      forked.stdout.pipe(process.stdout)
    }
    forked.stderr.pipe(process.stderr)
  }

  if (options.stdoutHandlers) {
    Object.keys(options.stdoutHandlers).forEach(key => {
      forked.stdout.on(key, options.stdoutHandlers[key])
    })
  }

  if (options.eventEmitter && options.closeEvent) {
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

  forked.on('close', (code, signal) => {
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
    emitCloseEvent(closeEventInfo)
    if (code) {
      const fullCommand = [command, ...(options.args || [])].join(' ')
      if (!options.neverRejectFinishedPromise) {
        finishedRej(new Error(`Fork failed with code [${code}] and signal [${signal}], command was [${fullCommand}]`))
      }
    } else {
      finishedRes()
    }
  })
  if (options.eventEmitter && options.passOnEvents) {
    const arr = options.passOnEvents.map ? [...options.passOnEvents] : [options.passOnEvents]
    arr.forEach(type => {
      addEventListener(type, event => {
        if (isOpen) {
          forked.send(marshallEvent(event, type))
        }
      })
    })
  }
  return {
    close: async (skipForkCloseEvent = false) => {
      if (isOpen) {
        cleanUpEventListeners()
        if (skipForkCloseEvent) {
          skipCloseEvent = true
        }
        process.kill(forked.pid, 'SIGTERM')
      }
      // eslint-disable-next-line no-unmodified-loop-condition
      while (isOpen) {
        await sleep(100)
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
    finishedPromise
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

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        const error = new Error(`Exit code was ${code}`)
        error.code = code
        if (errorOutput.length > 0) {
          error.errorOutput = errorOutput.join('\n')
        }
        reject(error)
      }
    })
  })
}

function spawn (command, args, options = {}) {
  const child = crossSpawn(command, args, { ...options })

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve(true)
      } else {
        const fullCommand = [command, ...args].join(' ')
        reject(new Error(`Exit code was ${code}, command was ${fullCommand}`))
      }
    })
  })
}

module.exports = {
  exec,
  spawn,
  fork
}
