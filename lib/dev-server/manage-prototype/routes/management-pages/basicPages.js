const http = require('node:http')

const { getPageNavLinks, awaitOrResolveWithDefault } = require('../../utils')
const { requestHttpsJson } = require('../../../../utils/requestHttps')
const kitVersion = require('../../../../../package.json').version
const { getConfig } = require('../../../../config')
const { findPagesInUsersKit } = require('../../../../utils')

const url = `${getConfig().npiApiBaseUrl}/v1/messages/npi/${encodeURIComponent(kitVersion)}`
const messagesPromise = requestHttpsJson(url, {}).catch(() => null)

function getModel (currentSection, req) {
  return {
    headerSubNavItems: getPageNavLinks(req),
    currentSection,
    currentUrl: req.originalUrl
  }
}

module.exports = {
  setupBasicPages: (router, config) => {
    router.get('/', async (req, res) => {
      const messagesResponse = await awaitOrResolveWithDefault(messagesPromise, 500, null)
      const messages = messagesResponse?.messages
      const upgradeAvailable = messagesResponse?.upgradeAvailable
      res.render('index', {
        ...getModel('Home', req),
        messages,
        upgradeAvailable,
        foundPages: findPagesInUsersKit()
      })
    })

    router.get('/clear-data', (req, res) => {
      if (!req.query.returnUrl && req.headers.referer && !req.headers.referer.includes('/manage-prototype')) {
        const relativeUrl = '/' + (req.headers.referer.split('/').slice(3).join('/') || '')
        res.redirect(req.originalUrl + (req.originalUrl.includes('?') ? '&' : '?') + 'returnUrl=' + encodeURIComponent(relativeUrl))
        return
      }
      res.render('session/clear-data', getModel('Clear session data', req))
    })

    router.post('/clear-data', async (req, res) => {
      const proxiedRequest = http.request({
        hostname: 'localhost',
        port: config.currentKitPort,
        path: '/manage-prototype/clear-data',
        method: 'POST',
        headers: req.headers
      })
      proxiedRequest.end((err) => {
        if (err) {
          res.redirect(req.originalUrl)
        } else {
          const [url, queryString] = req.originalUrl.split('?')
          res.redirect(url + '-success' + (queryString ? '?' + queryString : ''))
        }
      })
    })

    router.get('/clear-data-success', (req, res) => {
      res.render('session/clear-data-success', {
        ...getModel('Clear session data', req),
        returnUrl: req.query.returnUrl
      })
    })
  }
}
