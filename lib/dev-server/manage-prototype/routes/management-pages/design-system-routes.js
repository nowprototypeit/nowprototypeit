const { getPathToGeneratedCss, getPathToDesignSystemAssets } = require('../../build')
const express = require('express')
const path = require('path')
const userConfig = require('../../../../config')
const { getReloaderScript, warmUpReloaderScript } = require('../../utils')

module.exports = {
  setupDesignSystemRoutes: (router, config) => {
    warmUpReloaderScript()

    const pathToGeneratedCss = getPathToGeneratedCss()
    router.use('/assets/css', express.static(pathToGeneratedCss))
    router.use('/assets/icons', express.static(path.join(__dirname, '..', '..', 'assets', 'icons')))
    router.use('/assets/scripts/reloader-client.js', async (req, res, next) => {
      res.header('Content-Type', 'text/javascript')
      res.send(userConfig.getConfig().autoReloadPages ? await getReloaderScript() : '')
    })
    router.use('/assets/scripts', express.static(path.join(__dirname, '..', '..', 'assets', 'scripts')))
    const pathToDesignSystemAssets = getPathToDesignSystemAssets()
    router.use('/now-prototype-it-design-system/assets', express.static(pathToDesignSystemAssets))
  }
}
