// We're moving away form this approach, please add new work to lib/manage-prototype, see settings as an example

const {
  csrfProtection,
  getCsrfTokenHandler,
  getTemplatesHandler,
  getTemplatesViewHandler,
  getTemplatesInstallHandler,
  postTemplatesInstallHandler,
  getTemplatesPostInstallHandler,
  getPluginsHandler,
  postPluginsHandler,
  getPluginDetailsHandler,
  postPluginDetailsHandler,
  runPluginMode,
  getPluginsModeHandler,
  legacyUpdateStatusCompatibilityHandler, getPluginLookupHandler
} = require('./inherited-manage-prototype-handlers')
const { contextPath } = require('../../utils')

module.exports = {
  inheritedRoutes: (router) => {
    router.get('/csrf-token', getCsrfTokenHandler)

    router.get('/templates', getTemplatesHandler)

    router.get('/templates/view', getTemplatesViewHandler)

    router.get('/templates/install', getTemplatesInstallHandler)

    router.post('/templates/install', postTemplatesInstallHandler)

    router.get('/templates/post-install', getTemplatesPostInstallHandler)

    router.get('/plugins', (req, res) => {
      res.redirect(req.originalUrl.split('?')[0] + '/installed')
    })
    router.post('/plugins', postPluginsHandler)
    router.get('/plugins/installed', getPluginsHandler)
    router.get('/plugins/discover', getPluginsHandler)
    router.get('/plugins/lookup', getPluginLookupHandler)

    router.get('/plugins-installed', (req, res) => {
      res.redirect(contextPath + '/plugins/installed')
    })

    router.get('/plugin/:packageRef', getPluginDetailsHandler)
    router.post('/plugin', postPluginDetailsHandler)
    router.get('/plugin/:packageRef/:mode', getPluginsModeHandler)
    router.post('/plugin/:packageRef/:mode', csrfProtection, runPluginMode)

    // // Be aware that changing this path for monitoring the status of a plugin will affect the
    // // kit update process as the browser request and server route would be out of sync.
    router.post('/plugins/:mode', legacyUpdateStatusCompatibilityHandler)
  }
}
