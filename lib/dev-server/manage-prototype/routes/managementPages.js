const express = require('express')
const { setupSettingsRoutes } = require('./management-pages/settings')
const { setupBasicPages } = require('./management-pages/basicPages')
const { inheritedRoutes } = require('./management-pages/inherited-manage-prototype-routes')
const { setupPluginRoutes } = require('./management-pages/plugins')
const { setupDesignSystemRoutes } = require('./management-pages/design-system-routes')

module.exports = {
  managementPages: async (app, config) => {
    app.use('/manage-prototype', await setupManagePrototypeRouter(config))
  }
}

async function setupManagePrototypeRouter (config) {
  const router = express.Router()

  router.use((req, res, next) => {
    res.locals.nowPrototypeItLogoLink = 'https://nowprototype.it/'
    next()
  })

  setupBasicPages(router, config)
  setupSettingsRoutes(router)
  setupPluginRoutes(router)
  inheritedRoutes(router)
  setupDesignSystemRoutes(router)

  router.use((req, res) => {
    res.status(404).send('Prototype management page not found.')
  })
  return router
}
