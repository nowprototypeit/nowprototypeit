const fs = require('fs')
const path = require('path')
const config = require('../config')
const respectFileExtensions = config.getConfig().respectFileExtensions

function wrapInRawTags (fileContents) {
  return `{% raw %}${fileContents}{% endraw %}`
}

function getPathToViewFile (name, appViews) {
  let pathToFile
  const filename = name.split('/').pop()

  const viewExtensions = respectFileExtensions ? ['njk', 'md', 'html'] : ['njk', 'html']
  if (filename.includes('.') && fs.existsSync(name)) {
    pathToFile = name
  } else if (respectFileExtensions) {
    const flat = [
      ...appViews.map(viewDir => path.join(viewDir, name)),
      ...appViews.reduce((acc, viewDir) => acc.concat(...viewExtensions.map(ext => path.join(viewDir, `${name}.${ext}`))), [])
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

        const hasSomeMatching = appViews.some(appView => extensionPriority.some(extension => {
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
  return pathToFile
}

module.exports = {
  wrapInRawTags,
  getPathToViewFile
}
