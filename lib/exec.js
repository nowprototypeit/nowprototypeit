// npm dependencies
const { spawn: crossSpawn } = require('cross-spawn')
const cp = require('node:child_process')
const eventTypes = require('./dev-server/dev-server-event-types')

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

function execv2 (command, options) {
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })
  const commandParts = splitCommand(command)
  const spawnOptions = getStandardCpOptions(options)
  const child = cp.spawn(commandParts.command, commandParts.args, spawnOptions)
  addStdioHandlers(options, child)
  child.on('close', (code, signal) => {
    if (code) {
      if (!options.neverRejectFinishedPromise) {
        finishedRej(new Error(`exec failed with code [${code}] and signal [${signal}], command was [${JSON.stringify(command)}]`))
      }
    } else {
      finishedRes()
    }
  })

  return {
    finishedPromise,
    stdio: {
      stderr: child.stderr,
      stdout: child.stdout,
      stdin: child.stdin
    }
  }
}

function getStandardCpOptions (options) {
  const env = { ...(options.passThroughEnv ? process.env : {}), ...(options.env || {}) }
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
    forked.stderr.pipe(process.stderr)
  }

  if (options.stdoutHandlers) {
    Object.keys(options.stdoutHandlers).forEach(key => {
      forked.stdout.on(key, options.stdoutHandlers[key])
    })
  }
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
  const forkArgs = [command]
  if (options.args) {
    forkArgs.push(options.args)
  }
  forkArgs.push(getStandardCpOptions(options))
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

  addStdioHandlers(options, forked)

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
  fork,
  execv2
}
