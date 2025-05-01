const chokidar = require('chokidar')

function watch (whatToWatch, { allowGlobs = false, registerCloseFn = () => {} } = {}) {
  const listener = chokidar.watch(whatToWatch, {
    ignoreInitial: true,
    disableGlobbing: !allowGlobs
  })
  registerCloseFn(async () => {
    await listener.close()
  })
  return listener
}

module.exports = {
  watch
}
