const express = require('express')
const { setupSettingsRoutes } = require('./management-pages/settings')
const path = require('path')
const { setupBasicPages } = require('./management-pages/basicPages')
const { inheritedRoutes } = require('./management-pages/inherited-manage-prototype-routes')
const { setupPluginRoutes } = require('./management-pages/plugins')
const { getReloaderScript, warmUpReloaderScript } = require('../utils')
const { getPathToDesignSystemAssets, getPathToGeneratedCss } = require('../build')
const userConfig = require('../../../config')

module.exports = {
  managementPages: async (app, config) => {
    app.use('/manage-prototype', await setupManagePrototypeRouter(config))
  }
}

async function setupManagePrototypeRouter (config) {
  warmUpReloaderScript()
  const router = express.Router()

  router.use((req, res, next) => {
    res.locals.nowPrototypeItLogoLink = 'https://nowprototype.it/'
    next()
  })

  setupBasicPages(router, config)
  setupSettingsRoutes(router)
  setupPluginRoutes(router)
  inheritedRoutes(router)

  const pathToGeneratedCss = getPathToGeneratedCss()
  router.use('/assets/css', express.static(pathToGeneratedCss))
  router.use('/assets/icons', express.static(path.join(__dirname, '..', 'assets', 'icons')))
  router.use('/assets/scripts/reloader-client.js', async (req, res, next) => {
    res.header('Content-Type', 'text/javascript')
    res.send(userConfig.getConfig().autoReloadPages ? await getReloaderScript() : '')
  })
  router.use('/assets/scripts', express.static(path.join(__dirname, '..', 'assets', 'scripts')))
  const pathToDesignSystemAssets = getPathToDesignSystemAssets()
  router.use('/now-prototype-it-design-system/assets', express.static(pathToDesignSystemAssets))

  router.use((req, res) => {
    res.status(404).send('Prototype management page not found.')
  })
  return router
}
