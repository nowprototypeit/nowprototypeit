const nunjucks = require('nunjucks')
const config = require('../config')
const fs = require('fs')
const chokidar = require('chokidar')
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')
const plugins = require('../plugins/plugins')
const chokidarInstances = []
const { renderMarkdownAsNunjucks } = require('../markdownRenderers/api')
const { wrapInRawTags, getPathToViewFile } = require('./utils')

// https://mozilla.github.io/nunjucks/api.html#writing-a-loader

function getIncludeString () {
  return plugins.getByType('nunjucksMacros').map(({
    item: {
      macroName,
      importFrom
    }
  }) => `{% from "${importFrom}" import ${macroName} %}`).join('\n')
}

const filesToImportInto = plugins.getFileSystemPaths('importNunjucksMacrosInto')

function getSrcFromFilePath (pathToFile) {
  const fileContents = fs.readFileSync(pathToFile, 'utf8')

  if (config.getConfig().respectFileExtensions) {
    if (pathToFile.endsWith('.md')) {
      return renderMarkdownAsNunjucks(fileContents)
    }

    if (!pathToFile.endsWith('.njk')) {
      return wrapInRawTags(fileContents)
    }
  }

  if (filesToImportInto.includes(pathToFile)) {
    return [getIncludeString(), fileContents].join('\n')
  }
  return fileContents
}

const NunjucksLoader = nunjucks.Loader.extend({
  init: function (appViews) {
    const timer = startPerformanceTimer()
    this.appViews = appViews || []
    this.async = false
    this.noCache = config.getConfig().isDevelopment

    const updateHandler = (filePath) => {
      appViews.some((viewDir) => {
        if (filePath.startsWith(viewDir)) {
          this.emit('update', filePath.substring(viewDir.length + 1).split('\\').join('/'))
          return true
        }
        return false
      })
    }

    if (this.noCache) {
      appViews.forEach((viewDir) => chokidarInstances.push(chokidar.watch(viewDir, {
        ignoreInitial: true, awaitWriteFinish: true, disableGlobbing: true // Prevents square brackets from being mistaken for globbing characters
      })
        .on('add', updateHandler)
        .on('change', updateHandler)
        .on('unlink', updateHandler)
      ))
    }

    endPerformanceTimer('NunjucksLoader.init', timer)
  },

  getSource: function (name) {
    const timer = startPerformanceTimer()
    const appViews = this.appViews
    const pathToFile = getPathToViewFile(name, appViews)

    if (!pathToFile) {
      if (name.startsWith('govuk-prototype-kit') || name.startsWith('nowprototypeit')) {
        try {
          return this.getSource(name.replace('govuk-prototype-kit', 'prototype-core').replace('nowprototypeit', 'prototype-core'))
        } catch (e) {
        }
      }
      endPerformanceTimer('getSource (failure)', timer)
      const error = new Error(`template not found: ${name}, directories checked are: ${(appViews || []).join(', ')}`)
      error.internalErrorCode = 'TEMPLATE_NOT_FOUND'
      throw error
    }

    const output = {
      src: getSrcFromFilePath(pathToFile),
      path: pathToFile,
      noCache: this.noCache
    }

    endPerformanceTimer('getSource (success)', timer)

    return output
  }
})

NunjucksLoader.stopWatchingNunjucks = () => {
  chokidarInstances.forEach(x => x.close())
}

module.exports = NunjucksLoader
