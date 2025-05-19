const express = require('express')

const hostingConfigResponseByKitVersion = {}
let defaultHostingConfigResponse = {}
let baseUrl

function setBaseUrlForHostingRouter (url) {
  baseUrl = url
}

function resetHosting () {
  defaultHostingConfigResponse = {
    isCompatible: true,
    loggedOutMessage: 'This is the **default** for the fake API'
  }
  Object.keys(hostingConfigResponseByKitVersion).forEach(key => {
    delete hostingConfigResponseByKitVersion[key]
  })
}

const hostingRouter = express.Router()
resetHosting()

hostingRouter.get('/v1/hosting-config-for-nowprototypeit/:version', (req, res) => {
  const version = req.params.version
  const messages = hostingConfigResponseByKitVersion[version] || replaceVarsInDefaultMessage({ version })
  res.json(messages)
})

hostingRouter.put('/v1/hosting-config-for-nowprototypeit/__default__', [express.json()], (req, res) => {
  defaultHostingConfigResponse = { ...req.body }
  res.send({ success: true })
})

hostingRouter.put('/v1/hosting-config-for-nowprototypeit/:version', [express.json()], (req, res) => {
  const config = { ...req.body }
  if (config.hostingBaseUrl?.includes('{{SELF_URL}}')) {
    config.hostingBaseUrl = config.hostingBaseUrl.replace('{{SELF_URL}}', baseUrl)
  }
  hostingConfigResponseByKitVersion[req.params.version] = config
  console.log(`set hosting config for version [${req.params.version}]`, hostingConfigResponseByKitVersion[req.params.version])
  res.send({ success: true })
})

module.exports = {
  resetHosting,
  hostingRouter,
  setBaseUrlForHostingRouter
}

function replaceVarsInDefaultMessage (vars = {}) {
  return Object.keys(defaultHostingConfigResponse).reduce((acc, key) => {
    acc[key] = vars[key] ?? defaultHostingConfigResponse[key]
    return acc
  }, {})
}
