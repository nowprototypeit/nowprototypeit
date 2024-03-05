const chokidar = require('chokidar')

function watch (whatToWatch, { allowGlobs = false }) {
  return chokidar.watch(whatToWatch, {
    ignoreInitial: true,
    disableGlobbing: !allowGlobs
  })
}

module.exports = {
  watch
}
