const nunjucks = require('nunjucks')
const config = require('../config')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')
const plugins = require('../plugins/plugins')
const chokidarInstances = []
const { renderMarkdownAsNunjucks } = require('../markdownRenderers/api')
const { wrapInRawTags } = require('./utils')
const respectFileExtensions = config.getConfig().respectFileExtensions

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
    let pathToFile
    const filename = name.split('/').pop()
    const viewExtensions = respectFileExtensions ? ['njk', 'md', 'html'] : ['njk', 'html']

    if (filename.includes('.') && fs.existsSync(name)) {
      pathToFile = name
    } else if (respectFileExtensions) {
      const flat = [
        ...this.appViews.map(viewDir => path.join(viewDir, name)),
        ...this.appViews.reduce((acc, viewDir) => acc.concat(...viewExtensions.map(ext => path.join(viewDir, `${name}.${ext}`))), [])
      ]
      const found = flat.find(fs.existsSync)
      if (found) {
        pathToFile = found
      }
    } else {
      const dirname = name.substring(0, name.lastIndexOf(filename) - 1)
      // The primary view extension is the original filename extension if it exists or the first entry in the viewExtensions
      const [viewName, primaryViewExtension = viewExtensions[0]] = filename.split('.')
      // The secondary view extension is the extension remaining that is not the primary extension
      const remainingFileExtensions = viewExtensions.filter(extension => extension !== primaryViewExtension)

      while (remainingFileExtensions.length > 0) {
        const currentFileExtension = remainingFileExtensions.shift()
        if (filename.includes('.') && fs.existsSync(name.replace('.' + primaryViewExtension, '.' + currentFileExtension))) {
          pathToFile = name.replace('.' + primaryViewExtension, '.' + currentFileExtension)
        } else {
          const extensionPriority = [primaryViewExtension, currentFileExtension]

          const hasSomeMatching = this.appViews.some(appView => extensionPriority.some(extension => {
            const currentPathToFile = path.join(dirname.startsWith(appView) ? '' : appView, dirname, viewName + '.' + extension)
            if (fs.existsSync(currentPathToFile)) {
              pathToFile = currentPathToFile
              return true
            }
            return false
          }))

          if (hasSomeMatching) {
            break
          }
        }
      }
    }

    if (!pathToFile) {
      if (name.startsWith('govuk-prototype-kit') || name.startsWith('nowprototypeit')) {
        try {
          return this.getSource(name.replace('govuk-prototype-kit', 'prototype-core').replace('nowprototypeit', 'prototype-core'))
        } catch (e) {
        }
      }
      endPerformanceTimer('getSource (failure)', timer)
      const error = new Error(`template not found: ${name}, directories checked are: ${(this.appViews || []).join(', ')}`)
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
