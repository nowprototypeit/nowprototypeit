const express = require('express')
const { setupSettingsRoutes } = require('./management-pages/settings')
const { setupBasicPages } = require('./management-pages/basicPages')
const { inheritedRoutes } = require('./management-pages/inherited-manage-prototype-routes')
const { setupPluginRoutes } = require('./management-pages/plugins')
const { setupDesignSystemRoutes } = require('./management-pages/design-system-routes')
const { setupHostingPages } = require('./management-pages/hosting')

module.exports = {
  managementPages: async (app, config) => {
    app.use('/manage-prototype', await setupManagePrototypeRouter(config))
  },
  justUploadPages: async (app, options) => {
    app.use('/manage-prototype', await setupJustUploadRouter(options))
  }
}

function setupRouter () {
  const router = express.Router()

  router.use((req, res, next) => {
    res.locals.nowPrototypeItLogoLink = 'https://nowprototype.it/'
    next()
  })
  return router
}

function addNotFoundHandler (router) {
  router.use((req, res) => {
    res.status(404).send('Prototype management page not found.')
  })
}

async function setupManagePrototypeRouter (config) {
  const router = setupRouter()

  setupBasicPages(router, config)
  setupSettingsRoutes(router)
  setupPluginRoutes(router)
  inheritedRoutes(router)
  setupDesignSystemRoutes(router)
  setupHostingPages(router, {
    mode: 'integrated',
    prototypeDir: config.prototypeDir
  })

  addNotFoundHandler(router)
  return router
}

async function setupJustUploadRouter (options) {
  const router = setupRouter()

  setupDesignSystemRoutes(router)
  setupHostingPages(router, {
    mode: 'just-upload',
    ...options
  })

  router.use((req, res, next) => {
    if (req.originalUrl.startsWith('/manage-prototype/hosting') || req.originalUrl.startsWith('/manage-prototype/npi-cloud-upload')) {
      next()
      return
    }
    res.redirect('/manage-prototype/npi-cloud-upload')
  })

  addNotFoundHandler(router)
  return router
}
