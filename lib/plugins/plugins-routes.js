const requests = require('../../index').requests
const plugins = require('./plugins')
const { getConfig } = require('../config')

function getSetup (key, useContextPath) {
  return () => {
    plugins.getPackageNameAndFileSystemPaths('expressRouters').forEach(({ packageName, fileSystemPath }) => {
      const result = require(fileSystemPath)
      if (result && result[key]) {
        const contextPath = useContextPath ? ['', 'plugin-routes', packageName].join('/') : '/'
        const router = requests.setupRouter(contextPath)
        result[key](router, { contextPath })
      }
    })
  }
}

const addGlobalPluginRouters = getSetup('setupNamespacedRouter', true)
const addNamespacedPluginRouters = getSetup('setupGlobalRouter', false)
// Serve assets from plugins
function setupPathsFor (item) {
  plugins.getPublicUrlAndFileSystemPaths(item)
    .forEach(paths => {
      requests.serveDirectory(paths.publicUrl, paths.fileSystemPath)
      // Keep /extension-assets path for backwards compatibility
      // TODO: Remove in v14
      requests.serveDirectory(
        paths.publicUrl.replace('plugin-assets', 'extension-assets'), paths.fileSystemPath)
    })
}

module.exports = {
  highPriorityPluginRoutes: () => {
    setupPathsFor('scripts')
    setupPathsFor('stylesheets')
    setupPathsFor('assets')
    addGlobalPluginRouters()
  },
  lowPriorityPluginRoutes: () => {
    addNamespacedPluginRouters()
  }
}
