// node dependencies
const path = require('path')

// npm dependencies
const fsp = require('fs/promises')
const fs = require('node:fs')
const sass = require('sass')

// local dependencies
const plugins = require('./plugins/plugins')
const {
  projectDir,
  appSassDir,
  libSassDir,
  tmpDir,
  tmpSassDir,
  publicCssDir
} = require('./utils/paths')
const { startPerformanceTimer, endPerformanceTimer } = require('./utils/performance')
const { verboseLog } = require('./utils/verboseLogger')
const events = require('./dev-server/dev-server-events')
const { REGENERATE_KIT_SASS, KIT_SASS_ERROR, RELOAD_PAGE } = require('./dev-server/dev-server-event-types')

const appSassOptions = {
  filesToSkip: [
    'application.scss'
  ]
}

const libSassOptions = {
  filesToRename: {
    'prototype.scss': 'application.css'
  }
}

function generateNunjucksSync () {
  plugins.setPluginsByType()
}

async function generateAssets () {
  verboseLog('************************ GENERATE ASSETS START ***************************')
  const timer = startPerformanceTimer()
  plugins.setPluginsByType()
  clean()
  await Promise.all([
    sassPlugins(),
    proxyUserSassIfItExists('application.scss'),
    proxyUserSassIfItExists('settings.scss')
  ])
  endPerformanceTimer('generateAssets (without css)', timer)
  const timer2 = startPerformanceTimer()
  await generateCss()
  endPerformanceTimer('generateAssets (just css)', timer2)
  verboseLog('************************ GENERATE ASSETS END ***************************')
}

function clean () {
  cleanScss()
  ;['public', '.port.tmp', '.tmp/port.tmp'].forEach(relativePath => {
    try {
      fs.rmSync(path.join(projectDir, relativePath), { recursive: true, force: true })
    } catch (e) {}
  })
}

function cleanScss () {
  try {
    fs.rmSync(path.join(projectDir, '.tmp/sass'), { recursive: true, force: true })
  } catch (e) {}
}

async function ensureTempDirExists (dir = tmpDir) {
  try {
    await fsp.mkdir(dir, { recursive: true })
  } catch (e) {
    verboseLog('This should never happen (as long as there\'s disk space) but it does occasionally on Windows specifically on this test features\\settings\\plugin-settings.feature:4', e)
    verboseLog('It\'s either the async stages of the mkdir or it\'s an actual issue, trying again as sync')
    fs.mkdirSync(dir, { recursive: true })
  }
  await fsp.writeFile(path.join(tmpDir, '.gitignore'), '*')
}

function sassInclude (filePath) {
  return `@import "${filePath.split(path.sep).join('/')}";`
}

function sassVariables () {
  const prepareValue = (value) => {
    const typeOfValue = typeof value
    if (typeOfValue === 'string') {
      return JSON.stringify(value)
    } else if (Array.isArray(value)) {
      return `(${value.map(prepareValue).join(', ')})`
    } else if (typeOfValue === 'boolean') {
      return value ? 'true' : 'false'
    } else if (typeOfValue === 'number' || typeOfValue === 'bigint') {
      return value
    }
  }

  return plugins.getSassVariables().map(({ key, value, isDefault }) => {
    return `$${key}: ${prepareValue(value)}${isDefault ? ' !default' : ''};`
  }).join('\n')
}

async function sassPlugins () {
  const timer = startPerformanceTimer()

  const fileContents = sassVariables() +
    plugins.getFileSystemPaths('sass')
      .map(sassInclude)
      .join('\n')

  await ensureTempDirExists(tmpSassDir)

  await fsp.writeFile(path.join(tmpSassDir, '_plugins.scss'), fileContents)
  verboseLog('************************ SASS PLUGINS WRITTEN ***************************')

  endPerformanceTimer('sassPlugins', timer)
}

async function proxyUserSassIfItExists (filename) {
  const timer = startPerformanceTimer()
  const userFilePath = path.join(projectDir, 'app', 'assets', 'sass', filename)
  const proxyFilePath = path.join(tmpSassDir, 'user', filename)
  const proxyFileLines = []
  if (fs.existsSync(userFilePath)) {
    verboseLog('User Sass file exists', userFilePath)
    proxyFileLines.push(sassInclude(userFilePath))
  } else {
    verboseLog('User Sass file doesn\'t exist', userFilePath)
  }
  await ensureTempDirExists(path.dirname(proxyFilePath))

  await fsp.writeFile(path.join(proxyFilePath), proxyFileLines.join('\n'))
  verboseLog(`************************ SASS FILE CREATED ${filename} ***************************`)
  endPerformanceTimer('proxyUserSassIfItExists', timer)
}

async function _generateCss (sassPath, cssPath, options = {}) {
  const timer = startPerformanceTimer()
  const { filesToSkip = [], filesToRename = {} } = options
  if (!fs.existsSync(sassPath)) return
  await fsp.mkdir(cssPath, { recursive: true })
  await Promise.all((await fsp.readdir(sassPath))
    .filter(file => ((
      file.endsWith('.scss') &&
      !file.startsWith('_') &&
      !filesToSkip.includes(file)
    )))
    .map(async file => {
      try {
        const timer = startPerformanceTimer()
        const result = sass.compile(path.join(sassPath, file), {
          quietDeps: true,
          loadPaths: [projectDir],
          sourceMap: true,
          sourceMapIncludeSources: true,
          style: 'expanded'
        })
        endPerformanceTimer('sass.compile', timer)

        const cssFilename = filesToRename[file] || file.replace('.scss', '.css')
        await fsp.writeFile(path.join(cssPath, cssFilename), result.css)
      } catch (e) {
        events.emit(KIT_SASS_ERROR, {
          fileCompiling: file,
          error: {
            type: e.type,
            message: e.message,
            stack: e.stack
          }
        })
      }
    }))
  endPerformanceTimer('_generateCss', timer)
}

async function generateCss () {
  verboseLog('************************ GENERATE CSS START ***************************')
  const timer = startPerformanceTimer()
  await Promise.all([
    _generateCss(libSassDir, publicCssDir, libSassOptions),
    _generateCss(appSassDir, publicCssDir, appSassOptions)
  ])
  events.emit(RELOAD_PAGE)
  endPerformanceTimer('generateCss', timer)
  verboseLog('************************ GENERATE CSS END ***************************')
}

events.on(REGENERATE_KIT_SASS, async () => {
  await generateAssets()
})

module.exports = {
  generateAssets,
  generateCss,
  generateNunjucksSync,
  proxyUserSassIfItExists
}
