const chokidar = require('chokidar')
const path = require('node:path')

module.exports = {
  watch: (globOrFileOrDir, { allowGlobs = false, fileExtensions = [], allFileExtensions = false, recursive = false, registerCloseFn = () => {} }) => {
    if (allowGlobs) {
      throw new Error('We\'re trying not to use globs.')
    }

    if (recursive && !fileExtensions?.length && !allFileExtensions) {
      throw new Error('No file extensions provided for watching. Please provide at least one file extension.')
    }

    function isIgnored (filePath, stats) {
      if (!stats?.isFile()) {
        return false
      }
      if (allFileExtensions) {
        return false
      }
      const extension = path.extname(filePath)
      return !extension || !fileExtensions.includes(extension.split('.')[[1]])
    }
    return chokidar.watch(globOrFileOrDir, {
      ignoreInitial: true,
      ignored: isIgnored,
      recursive
    }).on('all', (event, path) => {
      console.log(event, path)
    })
  }
}
