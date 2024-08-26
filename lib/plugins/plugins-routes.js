const requests = require('../../index').requests
const plugins = require('./plugins')

function addPluginRouters () {
  plugins.getPackageNameAndFileSystemPaths('expressRouters').forEach(({ packageName, fileSystemPath }) => {
    const result = require(fileSystemPath)
    if (result?.setupNamespacedRouter) {
      const contextPath = ['', 'plugin-routes', packageName].join('/')
      const router = requests.setupRouter(contextPath)
      result.setupNamespacedRouter(router, { contextPath })
    }
  })
}

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

setupPathsFor('scripts')
setupPathsFor('stylesheets')
setupPathsFor('assets')
addPluginRouters()
