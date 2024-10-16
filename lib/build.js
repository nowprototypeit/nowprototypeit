// node dependencies
const path = require('path')

// npm dependencies
const fse = require('fs-extra')
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
const { KIT_SASS_REGENERATED, REGENERATE_KIT_SASS, KIT_SASS_ERROR } = require('./dev-server/dev-server-event-types')

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

function generateAssetsSync () {
  verboseLog('************************ GENERATE ASSETS ***************************')
  const timer = startPerformanceTimer()
  plugins.setPluginsByType()
  clean()
  sassPlugins()
  proxyUserSassIfItExists('application.scss')
  proxyUserSassIfItExists('settings.scss')

  generateCssSync()
  endPerformanceTimer('generateAssetsSync', timer)
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

function ensureTempDirExists (dir = tmpDir) {
  fse.ensureDirSync(dir, { recursive: true })
  fse.writeFileSync(path.join(tmpDir, '.gitignore'), '*')
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

function sassPlugins () {
  const timer = startPerformanceTimer()

  const fileContents = sassVariables() +
    plugins.getFileSystemPaths('sass')
      .map(sassInclude)
      .join('\n')

  ensureTempDirExists(tmpSassDir)

  fse.writeFileSync(path.join(tmpSassDir, '_plugins.scss'), fileContents)
  endPerformanceTimer('sassPlugins', timer)
}

function proxyUserSassIfItExists (filename) {
  const timer = startPerformanceTimer()
  const userFilePath = path.join(projectDir, 'app', 'assets', 'sass', filename)
  const proxyFilePath = path.join(tmpSassDir, 'user', filename)
  const proxyFileLines = []
  if (fse.existsSync(userFilePath)) {
    proxyFileLines.push(sassInclude(userFilePath))
  }
  ensureTempDirExists(path.dirname(proxyFilePath))

  fse.writeFileSync(path.join(proxyFilePath), proxyFileLines.join('\n'))
  endPerformanceTimer('proxyUserSassIfItExists', timer)
}

function _generateCssSync (sassPath, cssPath, options = {}) {
  const { filesToSkip = [], filesToRename = {} } = options
  if (!fse.existsSync(sassPath)) return
  fse.mkdirSync(cssPath, { recursive: true })
  fse.readdirSync(sassPath)
    .filter(file => ((
      file.endsWith('.scss') &&
      !file.startsWith('_') &&
      !filesToSkip.includes(file)
    )))
    .forEach(file => {
      try {
        const result = sass.compile(path.join(sassPath, file), {
          quietDeps: true,
          loadPaths: [projectDir],
          sourceMap: true,
          sourceMapIncludeSources: true,
          style: 'expanded'
        })

        const cssFilename = filesToRename[file] || file.replace('.scss', '.css')
        fse.writeFileSync(path.join(cssPath, cssFilename), result.css)
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
    })
}

function generateCssSync (state) {
  verboseLog('************************ GENERATE SASS ***************************')
  verboseLog(state)
  const timer = startPerformanceTimer()
  _generateCssSync(libSassDir, publicCssDir, libSassOptions)
  _generateCssSync(appSassDir, publicCssDir, appSassOptions)
  events.emit(KIT_SASS_REGENERATED)
  endPerformanceTimer('generateCssSync', timer)
}

events.on(REGENERATE_KIT_SASS, () => {
  generateAssetsSync()
})

module.exports = {
  generateAssetsSync,
  generateCssSync,
  generateNunjucksSync,
  proxyUserSassIfItExists
}
