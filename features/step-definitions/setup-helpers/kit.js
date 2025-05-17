const { randomUUID } = require('node:crypto')
const { findAvailablePortWithoutUser } = require('./findPort')
const path = require('node:path')
const os = require('node:os')
const fsp = require('node:fs').promises
const { fork } = require('../../../lib/exec')
const { packageDir } = require('../../../lib/utils/paths')
const { listenForShutdown } = require('../../../lib/utils/shutdownHandlers')
const { setupPromise, sleep } = require('../../../lib/utils')
listenForShutdown('kit setup for tests')

const showKitStdio = process.env.SHOW_KIT_STDIO === 'true'
const kitShouldBeDeleted = process.env.LEAVE_KIT_AFTER_TEST !== 'true'

async function setupKit (options) {
  const kitDir = path.join(os.tmpdir(), 'npi-browser-tests', `nowprototypeit-govuk-cucumberjs-${randomUUID()}`)
  const port = await findAvailablePortWithoutUser()

  await createKit({
    projectDir: packageDir,
    port,
    targetDir: kitDir,
    providedOptions: options
  })

  const configPath = path.join(kitDir, 'app', 'config.json')
  const existingConfig = await fsp.readFile(configPath, 'utf8')
  const newConfig = {
    ...JSON.parse(existingConfig),
    ...options.appConfigAdditions || {}
  }
  await fsp.writeFile(configPath, JSON.stringify(newConfig), 'utf8')
  const versionPromise = fsp.readFile(path.join(kitDir, 'node_modules', 'nowprototypeit', 'package.json')).then(JSON.parse).then(x => x?.version)

  const kitThread = fork(path.join(kitDir, 'node_modules', 'nowprototypeit', 'bin', 'cli'), {
    args: [
      'dev'
    ],
    passThroughEnv: true,
    hideStdout: !showKitStdio,
    hideStderr: !showKitStdio,
    cwd: kitDir,
    env: {
      PORT: port,
      ...(options?.env || {})
    }
  })

  const kitStartedPromiseParts = setupPromise()

  let url = null
  let fullStdoutTmp = ''
  const listener = (data) => {
    const str = data.toString()
    fullStdoutTmp += str
    const urlPreludeLine = 'The Prototype Kit is now running at:'
    if (!fullStdoutTmp.includes(urlPreludeLine)) {
      return
    }
    const lines = fullStdoutTmp.split('\n')
    const urlLine = lines.findIndex(line => line.includes(urlPreludeLine))
    if (urlLine === -1) {
      return
    }
    const nextLine = lines[urlLine + 1]
    if (!nextLine.includes('://')) {
      return
    }
    kitThread.stdio.stdout.removeListener('data', listener)
    url = nextLine.trim()
    kitStartedPromiseParts.resolve()
  }
  kitThread.stdio.stdout.on('data', listener)

  let fullStdoutAndStderr = ''
  kitThread.stdio.stderr.on('data', (data) => {
    fullStdoutAndStderr += data.toString()
  })
  kitThread.stdio.stdout.on('data', (data) => {
    fullStdoutAndStderr += data.toString()
  })

  await kitStartedPromiseParts.promise

  const close = async () => {
    kitThread.stdio.stdin.write('stop\n') // this is how we ask the user to stop the kit
    const closeTimeout = setTimeout(() => {
      console.error('')
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.error('Had to fall back to closing the kit with commands.')
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.error('')
      kitThread.close() // this is the backup in case that doesn't work
    }, 5000)
    await kitThread.finishedPromise
    clearTimeout(closeTimeout)
    if (kitShouldBeDeleted) {
      const start = Date.now()
      const giveUpTimestamp = start + 1000 * 30
      const halfWayToGiveUpTimestamp = start + 1000 * 15
      let succeeded = false
      while (!succeeded && (Date.now() < giveUpTimestamp)) {
        try {
          const timeToForceRm = Date.now() > halfWayToGiveUpTimestamp
          if (timeToForceRm) {
            console.log('running force rm')
          }
          await fsp.rm(kitDir, { recursive: true, force: timeToForceRm })
          succeeded = true
        } catch (e) {
          console.error('Failed to delete kit dir', e)
          await sleep(300)
        }
      }
      if (!succeeded) {
        throw new Error('Failed to clean kit')
      }
    }
  }
  function addNextKitRestartListener (handler) {
    const listener = (data) => {
      const str = data.toString()
      if (str.includes('Your prototype was restarted.')) {
        handler()
        kitThread.stdio.stdout.off('data', listener)
      }
    }
    kitThread.stdio.stdout.on('data', listener)
  }

  const restart = () => new Promise(resolve => {
    addNextKitRestartListener(() => {
      resolve()
    })
    kitThread.stdio.stdin.write('rs\n')
  })

  return {
    url,
    dir: kitDir,
    version: await versionPromise,
    close,
    reset: close,
    addNextKitRestartListener,
    getFullStdoutAndStdErr: () => fullStdoutAndStderr,
    restart
  }
}

async function createKit ({
  projectDir,
  port,
  targetDir,
  providedOptions
}) {
  const handledRootKeys = ['variantPluginName', 'appConfigAdditions', 'variantPluginDependency', 'neverReuseThisKit', 'unique', 'env']
  const unhandledRootKeys = Object.keys(providedOptions || {}).filter((key) => !handledRootKeys.includes(key))

  if (unhandledRootKeys.length > 0) {
    console.error(`Unhandled options:${unhandledRootKeys.join(', ')}`)
    throw new Error(`Unhandled options: ${unhandledRootKeys.join(', ')}`)
  }
  if (!targetDir) {
    throw new Error('targetDir is required')
  }
  if (!projectDir) {
    throw new Error('projectDir is required')
  }
  if (!port) {
    throw new Error('port is required')
  }
  const args = [
    'create',
    '--version=local',
    targetDir
  ]
  if (providedOptions && providedOptions.variantPluginName) {
    args.push('--variant', providedOptions.variantPluginName)
  }
  if (providedOptions && providedOptions.variantPluginDependency) {
    args.push('--variant-dependency', providedOptions.variantPluginDependency)
  }
  const kitCreationThread = fork(path.join(projectDir, 'bin', 'utils', 'main-cli.js'), {
    passThroughEnv: true,
    hideStdout: !showKitStdio,
    hideStderr: !showKitStdio,
    args
  })
  let fullStdout = ''
  kitCreationThread.stdio.stdout.on('data', (data) => {
    fullStdout += data.toString()
  })
  await kitCreationThread.finishedPromise
  validateStdout(fullStdout, targetDir)
}

module.exports = {
  setupKit
}

function validateStdout (fullStdout, targetDir) {
  const stdoutLines = fullStdout.split('\n').map(line => line.trim())

  const dirIndex = stdoutLines.findIndex(line => line === 'Change to your prototype directory:')
  if (dirIndex === -1) {
    throw new Error(`Kit creation did not return the expected output [${stdoutLines}]`)
  }
  const dir = stdoutLines[dirIndex + 1].split(' ').slice(1).join(' ')
  if (dir !== targetDir) {
    throw new Error(`Kit creation did not return the expected directory [${dir}] [${targetDir}]`)
  }

  const commandIndex = stdoutLines.findIndex(line => line === 'To run your prototype:')
  if (commandIndex === -1) {
    throw new Error(`Kit creation did not display run command [${stdoutLines}]`)
  }
  const runCommand = stdoutLines[commandIndex + 1]
  if (runCommand !== 'npm run dev') {
    throw new Error(`Kit creation did not return [npm run dev] as the start command [${runCommand}]`)
  }
}
