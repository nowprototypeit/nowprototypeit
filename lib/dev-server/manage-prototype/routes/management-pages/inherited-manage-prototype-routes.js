// We're moving away form this approach, please add new work to lib/manage-prototype, see settings as an example

const {
  csrfProtection,
  getCsrfTokenHandler,
  getPasswordHandler,
  postPasswordHandler,
  developmentOnlyMiddleware,
  getHomeHandler,
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
  legacyUpdateStatusCompatibilityHandler
} = require('./inherited-manage-prototype-handlers')

module.exports = {
  inheritedRoutes: (router) => {
    router.get('/csrf-token', getCsrfTokenHandler)

    // Render password page with a returnURL to redirect people to where they came from
    router.get('/password', getPasswordHandler)

    // Check authentication password
    router.post('/password', postPasswordHandler)

    // Middleware to ensure the routes specified below will render the manage-prototype-not-available
    // view when the prototype is not running in development
    router.use(developmentOnlyMiddleware)

    router.get('/', getHomeHandler)

    router.get('/templates', getTemplatesHandler)

    router.get('/templates/view', getTemplatesViewHandler)

    router.get('/templates/install', getTemplatesInstallHandler)

    router.post('/templates/install', postTemplatesInstallHandler)

    router.get('/templates/post-install', getTemplatesPostInstallHandler)

    router.get('/plugins', getPluginsHandler)
    router.post('/plugins', postPluginsHandler)
    router.get('/plugins-installed', getPluginsHandler)

    router.get('/plugin/:packageRef', getPluginDetailsHandler)
    router.post('/plugin', postPluginDetailsHandler)
    router.get('/plugin/:packageRef/:mode', getPluginsModeHandler)
    router.post('/plugin/:packageRef/:mode', csrfProtection, runPluginMode)

    // // Be aware that changing this path for monitoring the status of a plugin will affect the
    // // kit update process as the browser request and server route would be out of sync.
    router.post('/plugins/:mode', legacyUpdateStatusCompatibilityHandler)
  }
}
