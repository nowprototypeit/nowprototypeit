const { parse } = require('./argv-parser')
const argv = parse(process.argv, {
  booleans: ['no-version-control', 'verbose', 'running-within-create-script', 'use-njk-extensions', 'suppress-node-version-warning']
})

const path = require('path')

const fs = require('fs')
const fse = require('fs-extra')
const { spawn, fork } = require('../../lib/exec')
const { verboseLogger, progressLogger } = require('./loggers')
const { npmInstall } = require('./index')
const { projectDir } = require('../../lib/utils/paths')
const { validatePlugin } = require('../../lib/plugins/plugin-validator')
const { flattenArray } = require('../../lib/utils/arrayTools')
const events = require('../../lib/dev-server/dev-server-events')
const eventTypes = require('../../lib/dev-server/dev-server-event-types')

// Avoid requiring any kit server code at the top-level as we might want to
// change environment variables below.

const currentDirectory = process.cwd()
const kitRoot = path.join(__dirname, '..', '..')
const packageJsonContents = require('../../package.json')
const { runShutdownFunctions } = require('../../lib/utils/shutdownHandlers')
const kitVersion = packageJsonContents.version
const kitProjectName = packageJsonContents.name
const kitEntryPoint = packageJsonContents._cliDevEntryPoint

function displaySuccessMessage () {
  console.log('')
  console.log('Prototype created')
  if (argv.paths.length > 0) {
    console.log('')
    console.log('Change to your prototype directory:')
    console.log(`  cd ${argv.paths[0]}`)
  }
  console.log('')
  console.log('To run your prototype:')
  console.log('  npm run dev')
  console.log('')
}

function usage () {
  const prog = 'nowprototypeit'
  console.log(`
${prog} <command>

Usage:

${prog} create
${prog} create /exact/location/to/create/in
${prog} create relative/location/to/create/in

${prog} dev
${prog} serve
${prog} build
${prog} start`
  )
}

function getInstallLocation () {
  const chosenPath = argv.paths[0]
  if (chosenPath) {
    if (path.isAbsolute(chosenPath)) {
      return chosenPath
    }
    return path.resolve(chosenPath)
  }
  return currentDirectory
}

function getChosenKitDependency () {
  const defaultValue = 'nowprototypeit'
  const versionRequested = argv.options.version || argv.options.v

  if (!versionRequested) {
    return defaultValue
  }

  if (versionRequested === 'local' || versionRequested === 'local-symlink') {
    return kitRoot
  } else if (versionRequested) {
    if (versionRequested.match(/\d+\.\d+\.\d+/) ||
      versionRequested.match(/\d+\.\d+\.\d+-alpha\.\d+]/) ||
      versionRequested.match(/\d+\.\d+\.\d+-beta\.\d+]/)
    ) {
      return `${defaultValue}@${versionRequested}`
    } else {
      return versionRequested
    }
  }
  return defaultValue
}

// do some heuristics to try and catch situations where a user has run
// `npm start` (the wrong command) locally and warn them.
function warnIfNpmStart (argv, env) {
  if (
    argv.command === 'start' && // if user ran serve script then assume they know what they want
    env.NODE_ENV !== 'production' && // some hosting services set NODE_ENV
    env.PORT === undefined && // some hosting services set PORT
    env.PASSWORD === undefined // user should have set PASSWORD when setting up hosting
  ) {
    console.warn('Warning: It looks like you may have run the command `npm start` locally.')
    console.warn('try running `npm run dev`')
    console.warn()
    console.warn('If you see the above warning when trying to host your prototype online,')
    console.warn('it may be that your hosting service needs further configuration.')
    console.warn()
  }
}

function writeEmptyPackageJson (installDirectory) {
  return fse.writeJson(path.join(installDirectory, 'package.json'), {})
}

function getArgumentsToPassThrough () {
  return Object.keys(argv.options).map(name => `--${name}="${argv.options[name]}"`)
}

async function runCreate () {
  verboseLogger('Cli running from', __filename)

  console.log('')

  const installDirectory = getInstallLocation()
  const kitDependency = getChosenKitDependency()

  await fse.ensureDir(installDirectory)
  if ((await fse.readdir(installDirectory)).filter(filename => !filename.startsWith('.')).length > 0) {
    console.error(`Directory ${installDirectory} is not empty, please specify an empty location.`)
    process.exitCode = 3
    return
  }

  const variantName = getVariantName(false)

  if (variantName) {
    console.log(`Creating your prototype using the variant ${variantName}`)
    console.log('')
  }

  await writeEmptyPackageJson(installDirectory)

  progressLogger('Installing dependencies')

  await npmInstall(installDirectory, [kitDependency, getVariantDependency()])

  if ((argv.options.version || argv.options.v) === 'local-symlink') {
    const dependencyInstallLocation = path.join(installDirectory, 'node_modules', kitProjectName)
    await fse.remove(dependencyInstallLocation)
    await fse.ensureSymlink(kitDependency, dependencyInstallLocation)
  }

  progressLogger('Setting up your prototype')

  await spawn('npx', ['-y', 'nowprototypeit', 'init', '--running-within-create-script', installDirectory, `--created-from-version=${kitVersion}`, ...(getArgumentsToPassThrough()), '--suppress-node-version-warning'], {
    cwd: installDirectory,
    stdio: 'inherit'
  })
    .then(displaySuccessMessage)
    .catch(e => {
      console.error('Failed to initialise the kit')
      console.error(e)
      process.exit(0)
    })
}

function getVariantName (fallback = true) {
  if (argv.options.variant) {
    return argv.options.variant
  }
  if (fallback) {
    return 'nowprototypeit'
  }
  return undefined
}

function getVariantDependency () {
  return argv.options['variant-dependency'] || getVariantName()
}

function getModelFromTree (inheritanceTree, key) {
  const output = []

  function getConfigFromTreePosition (position) {
    if (!inheritanceTree[position]) {
      return
    }
    if (inheritanceTree[position].variantFile[key]) {
      inheritanceTree[position].variantFile[key].forEach(value => {
        if (value === '__INHERIT__') {
          getConfigFromTreePosition(position + 1)
        } else {
          output.push({
            packageName: inheritanceTree[position].name,
            value
          })
        }
      })
    } else {
      getConfigFromTreePosition(position + 1)
    }
  }

  getConfigFromTreePosition(0)
  return output
}

function getVariantNameFromInheritsFrom (variantFileObj) {
  return (variantFileObj?.inheritFrom || []).map(name => name === '@nowprototypeit/govuk' ? 'nowprototypeit' : name)
}

async function ensureVariantInheritancePackagesAreInstalled () {
  const previousModulePaths = []
  const queue = []

  function getModulePath (moduleName) {
    return path.join(projectDir, 'node_modules', moduleName)
  }

  function addToQueue (config) {
    if (!config.name) {
      throw new Error('No name provided for variant lookup, this is probably deeper inside the inheritance tree.')
    }
    if (queue.some(({ queuedName }) => queuedName === config.name)) {
      return
    }
    if (previousModulePaths.some(previousPath => previousPath === config.modulePath)) {
      return
    }
    queue.push(config)
  }

  addToQueue({
    name: getVariantName(),
    modulePath: getModulePath(getVariantName())
  })
  while (queue.length > 0) {
    const nextVariant = queue.shift()
    previousModulePaths.push(nextVariant.modulePath)
    if (!fs.existsSync(nextVariant.modulePath)) {
      await npmInstall(projectDir, [nextVariant.name])
    }
    const filePath = path.join(nextVariant.modulePath, 'now-prototype-it.variant.json')
    if (!fs.existsSync(filePath)) {
      const errorMessage = `The variant ${nextVariant.name} does not contain a now-prototype-it.variant.json file`
      console.error('')
      console.error(errorMessage)
      console.error('')
      throw new Error(errorMessage)
    }
    const variantFileObj = await fse.readJson(filePath).catch(() => undefined)
    if (!variantFileObj) {
      const errorMessage = `The variant ${nextVariant.name} does not contain a valid now-prototype-it.variant.json file`
      console.error('')
      console.error(errorMessage)
      console.error('')
      throw new Error(errorMessage)
    }
    const inheritsFrom = getVariantNameFromInheritsFrom(variantFileObj['version-2024-03'])
    inheritsFrom.forEach(name => addToQueue({
      name,
      modulePath: getModulePath(name)
    }))
  }
}

async function buildVariantDefinition () {
  async function readVariantFile (variantName) {
    const variantFileObj = await fse.readJson(path.join(projectDir, 'node_modules', variantName, 'now-prototype-it.variant.json'))
    if (variantFileObj['version-2024-03']) {
      return variantFileObj['version-2024-03']
    }
    throw new Error('Variant file does not contain an appropriate version key.  The only acceptable version at this time is "version-2024-03"')
  }

  async function getInheritanceTreeRecursive (variantName) {
    const variantFile = await readVariantFile(variantName)

    const inheritanceTree = flattenArray(await Promise.all(getVariantNameFromInheritsFrom(variantFile).map(async name => getInheritanceTreeRecursive(name))))
    inheritanceTree.unshift({
      name: variantName,
      variantFile
    })
    return inheritanceTree
  }

  const inheritanceTree = await getInheritanceTreeRecursive(getVariantName())

  const variantDefinition = {}

  const nodeModulesDir = path.join(projectDir, 'node_modules')

  variantDefinition.dependencies = getModelFromTree(inheritanceTree, 'installedPackages').map(({ value }) => value)
  variantDefinition.dirsToCopy = getModelFromTree(inheritanceTree, 'starterFileDirectories').map(({
    packageName,
    value
  }) => path.join(nodeModulesDir, packageName, value))
  variantDefinition.jsScripts = getModelFromTree(inheritanceTree, 'postCreateJSScripts').map(({
    packageName,
    value
  }) => ({
    script: path.join(nodeModulesDir, packageName, value),
    argv: getArgumentsToPassThrough()
  }))

  return variantDefinition
}

async function runInit () {
  // `init` is stage two of the install process (see above), it should be
  // called by `create` with the correct arguments.

  if (!argv.options['running-within-create-script'] && process.argv[3] !== '--') {
    usage()
    process.exitCode = 2
    return
  }

  const installLocation = getInstallLocation()

  await ensureVariantInheritancePackagesAreInstalled(installLocation)

  const variantDefinition = await buildVariantDefinition()

  await npmInstall(installLocation, variantDefinition.dependencies)

  while (variantDefinition.dirsToCopy.length > 0) {
    await fse.copy(variantDefinition.dirsToCopy.shift(), installLocation)
  }

  while (variantDefinition.jsScripts.length > 0) {
    const command = variantDefinition.jsScripts.shift()
    const scriptProcess = fork(command.script, command.argv, {
      cwd: installLocation,
      env: { ...process.env },
      stdio: 'inherit'
    })
    await scriptProcess.finishedPromise
  }
}

async function runDev () {
  let currentlyRunningKit
  console.log(`Now Prototype It ${kitVersion}`)
  console.log('')
  console.log('starting...')

  const handler = async () => {
    console.log('Stopping prototype...')
    events.emit(eventTypes.SHUTDOWN)
    await runShutdownFunctions()
    process.exit(0)
  }
  process.on('SIGTERM', () => {
    events.emit(eventTypes.SHUTDOWN)
  })
  process.on('SIGINT', () => {
    events.emit(eventTypes.SHUTDOWN)
  })
  events.once(eventTypes.SHUTDOWN, handler)

  let scriptProcess

  function start (entryPoint) {
    global.logTimeFromStart(`Running ${entryPoint}`)
    scriptProcess = fork(path.join(projectDir, 'node_modules', 'nowprototypeit', entryPoint), {
      cwd: projectDir,
      env: { ...process.env },
      stdio: 'inherit',
      eventEmitter: events,
      logAllEvents: true,
      passOnEvents: eventTypes.all
    })
    currentlyRunningKit = scriptProcess
  }

  function stop () {
    if (!currentlyRunningKit) {
      return Promise.resolve()
    }

    return new Promise(resolve => {
      currentlyRunningKit.finishedPromise
        .catch((err) => { console.log(err ? '' : '') })
        .then(() => {
          currentlyRunningKit = undefined
          resolve()
        })

      scriptProcess.close()
    })
  }

  events.on(eventTypes.FULL_KIT_RESTART, async (info) => {
    if (info.message) {
      console.log(info.message)
    } else {
      console.log(`Fully restarting your prototype${info.reason ? ` ${info.reason}` : ''}.`)
    }
    await stop()
    await new Promise(resolve => setTimeout(resolve, 1000))
    start(info.entryPoint || kitEntryPoint)
  })

  events.on(eventTypes.FULL_KIT_STOP, async (info) => {
    if (info.logMessage) {
      console.log(info.logMessage)
    } else {
      console.log(`Fully stopping your prototype${info.reason ? ` ${info.reason}` : ''}.`)
    }
    stop().then(() => {
      console.log('Prototype stopped.')
    })
  })

  start(kitEntryPoint)
}

async function runServe () {
  global.runningOnServerWatchNotNeeded = true
  warnIfNpmStart(argv, process.env)
  process.env.NODE_ENV = process.env.NODE_ENV || 'production'
  global.logTimeFromStart('Before building assets')
  await require('../../lib/build.js').generateAssets()
  global.logTimeFromStart('After building assets')
  require('../../listen-on-port')
}

async function runBuild () {
  await require('../../lib/build.js').generateAssets()
}

async function runValidatePlugin () {
  return validatePlugin(getInstallLocation(), argv)
}

;(async () => {
  verboseLogger(`Using kit version [${kitVersion}] for command [${argv.command}]`)
  verboseLogger('Argv:', argv)
  switch (argv.command) {
    case 'create':
      return runCreate()
    case 'init':
      return runInit()
    case 'dev':
      return runDev()
    case 'start':
      return await runServe()
    case 'serve':
      return await runServe()
    case 'build':
      return runBuild()
    case 'validate-plugin':
      return runValidatePlugin()
    case 'failed-to-launch':
    case 'validate-kit':
      console.log()
      console.log('Your prototype kit failed to launch.  You might want to try running `npm install` to ensure all dependencies are installed.')
      console.log()
      break
    case 'version':
      console.log(kitVersion)
      break
    case 'debug-print-env-info':
      console.log('Printing debug info about the environment')
      console.log('')
      console.log('Environment variables')
      console.log(process.env)
      console.log('')
      console.log('Process argv')
      console.log(process.argv)
      console.log('')
      console.log('Process features')
      console.log(process.features)
      console.log('')
      console.log('Process config')
      console.log(process.config)
      console.log('')
      console.log('Process mainModule')
      console.log(process.mainModule)
      console.log('')
      console.log('Process title')
      console.log(process.title)
      break
    default:
      usage()
      process.exitCode = 2
  }
})()
