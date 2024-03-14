// node dependencies
const path = require('path')

// npm dependencies
const del = require('del')
const fse = require('fs-extra')
const fs = require('fs')
const sass = require('sass')

// local dependencies
const plugins = require('./plugins/plugins')
const {
  projectDir,
  appSassDir,
  libSassDir,
  tmpDir,
  tmpSassDir,
  publicCssDir,
  shadowNunjucksDir,
  backupNunjucksDir,
  appViewsDir
} = require('./utils/paths')
const { recursiveDirectoryContentsSync } = require('./utils')
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
  cleanNunjucks()
  plugins.setPluginsByType()
  autoImportComponentsSync()
  createBackupNunjucksSync()
}

function generateAssetsSync () {
  verboseLog('************************ GENERATE ASSETS ***************************')
  const timer = startPerformanceTimer()
  plugins.setPluginsByType()
  clean()
  sassLegacyPatterns()
  sassPlugins()
  autoImportComponentsSync()
  createBackupNunjucksSync()
  proxyUserSassIfItExists('application.scss')
  proxyUserSassIfItExists('settings.scss')

  generateCssSync()
  endPerformanceTimer('generateAssetsSync', timer)
}

function cleanNunjucks () {
  cleanShadowNunjucks()
  cleanBackupNunjucks()
}
function cleanShadowNunjucks () {
  del.sync(shadowNunjucksDir)
}
function cleanBackupNunjucks () {
  del.sync(backupNunjucksDir)
}

function clean () {
  cleanNunjucks()
  cleanScss()
  del.sync(['public/**', '.port.tmp', '.tmp/port.tmp'])
}

function cleanScss () {
  del.sync('.tmp/sass/**')
}

function ensureTempDirExists (dir = tmpDir) {
  fse.ensureDirSync(dir, { recursive: true })
  fse.writeFileSync(path.join(tmpDir, '.gitignore'), '*')
}

function sassInclude (filePath) {
  return `@import "${filePath.split(path.sep).join('/')}";`
}

function sassLegacyPatterns () {
  const timer = startPerformanceTimer()
  const packageConfig = fse.readJsonSync(path.join(projectDir, 'package.json'))
  let fileContents
  if (packageConfig.dependencies['govuk-frontend']) {
    fileContents = [
      'contents-list',
      'mainstream-guide',
      'pagination',
      'related-items',
      'task-list'
    ].map(filePath => path.join(libSassDir, 'patterns', filePath))
      .map(sassInclude)
      .join('\n')
  } else {
    fileContents = ''
  }
  fse.ensureDirSync(tmpSassDir, { recursive: true })
  fse.writeFileSync(path.join(tmpSassDir, '_legacy-patterns.scss'), fileContents)
  endPerformanceTimer('sassLegacyPatterns', timer)
}

function sassVariables (contextPath = '', isLegacyGovukFrontend = false) {
  const vars = [
    {
      key: 'govuk-extensions-url-context',
      value: contextPath
    },
    {
      key: 'govuk-plugins-url-context',
      value: contextPath
    },
    {
      key: 'nowprototypeit-plugins-url-context',
      value: contextPath
    },
    {
      key: 'govuk-prototype-kit-major-version',
      value: 13
    },
    {
      key: 'govuk-suppressed-warnings',
      value: ['legacy-colour-param']
    }
  ]

  // Patch missing 'init.scss' before GOV.UK Frontend v4.4.0
  // in plugin versions, but will default to false for internal
  if (isLegacyGovukFrontend) {
    vars.push({
      key: 'govuk-assets-path',
      value: contextPath + '/govuk-frontend/govuk/assets/'
    }, {
      key: 'govuk-global-styles',
      value: true,
      isDefault: true
    }, {
      key: 'govuk-new-link-styles',
      value: true,
      isDefault: true
    })
  }

  vars.push(...plugins.getSassVariables())

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

  return vars.map(({ key, value, isDefault }) => {
    return `$${key}: ${prepareValue(value)}${isDefault ? ' !default' : ''};`
  }).join('\n')
}

function sassPlugins () {
  const timer = startPerformanceTimer()

  const fileContents = sassVariables('/plugin-assets', plugins.legacyGovukFrontendFixesNeeded()) +
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

function autoImportComponentsSync () {
  const timer = startPerformanceTimer()
  const includeString = plugins.getByType('nunjucksMacros').map(({
    item: {
      macroName,
      importFrom
    }
  }) => `{% from "${importFrom}" import ${macroName} %}`).join('\n')

  plugins.getByType('importNunjucksMacrosInto').map(({ packageName, item: templatePath }) => {
    return {
      shadowPath: path.join(shadowNunjucksDir, packageName, templatePath),
      newContents: [
        includeString,
        fse.readFileSync(path.join(projectDir, 'node_modules', packageName, templatePath), 'utf8')
      ].join('\n\n')
    }
  }).forEach(file => {
    fse.ensureDirSync(path.dirname(file.shadowPath))
    fse.writeFileSync(file.shadowPath, file.newContents, 'utf8')
  })
  endPerformanceTimer('autoImportComponentsSync', timer)
}

function createBackupNunjucksSync () {
  const filesInViews = [
    appViewsDir,
    ...plugins.getFileSystemPaths('nunjucksPaths')
  ].reverse().map(recursiveDirectoryContentsSync).flat()

  function backupFilesWithExtension (fileExtension, backupExtension) {
    const filesToBackup = filesInViews.filter(x => x.endsWith(fileExtension))
    filesToBackup.forEach(fileName => {
      const backupFilePath = path.join(backupNunjucksDir, fileName.substring(0, fileName.length - fileExtension.length) + backupExtension)
      const includeMethod = fileName.split('/').includes('layouts') ? 'extends' : 'include'
      const fileContents = `{% ${includeMethod} "${fileName}" %}`

      fse.ensureDirSync(path.dirname(backupFilePath))
      fs.writeFileSync(backupFilePath, fileContents, 'utf8')
    })
  }

  backupFilesWithExtension('.njk', '.html')
  backupFilesWithExtension('.html', '.njk')
}

module.exports = {
  generateAssetsSync,
  generateCssSync,
  generateNunjucksSync,
  proxyUserSassIfItExists
}
