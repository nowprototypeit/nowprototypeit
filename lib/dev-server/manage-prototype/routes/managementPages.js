const express = require('express')
const { setupSettingsRoutes } = require('./management-pages/settings')
const path = require('path')
const { setupBasicPages } = require('./management-pages/basicPages')
const { inheritedRoutes } = require('./management-pages/inherited-manage-prototype-routes')
const { setupPluginRoutes } = require('./management-pages/plugins')
const { getReloaderScript, warmUpReloaderScript } = require('../utils')

module.exports = {
  managementPages: async (app, config) => {
    app.use('/manage-prototype', await setupManagePrototypeRouter(config))
  }
}

async function setupManagePrototypeRouter (config) {
  warmUpReloaderScript()
  const router = express.Router()

  router.get('/tmp', (req, res) => {
    res.render('lookup-plugin', {})
  })

  setupBasicPages(router)
  setupSettingsRoutes(router)
  setupPluginRoutes(router)
  inheritedRoutes(router)

  router.use('/assets/css', express.static(path.join('.tmp', 'manage-prototype-css')))
  router.use('/assets/icons', express.static(path.join(__dirname, '..', 'assets', 'icons')))
  router.use('/assets/scripts/reloader-client.js', async (req, res, next) => {
    res.header('Content-Type', 'text/javascript')
    res.send(await getReloaderScript())
  })
  router.use('/assets/scripts', express.static(path.join(__dirname, '..', 'assets', 'scripts')))

  router.use((req, res) => {
    res.status(404).send('Prototype management page not found.')
  })
  return router
}
