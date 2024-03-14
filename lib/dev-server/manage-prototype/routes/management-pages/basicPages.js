const http = require('node:http')
const path = require('node:path')

const { getPageNavLinks, awaitOrResolveWithDefault } = require('../../utils')
const { requestHttpsJson } = require('../../../../utils/requestHttps')
const { packageDir } = require('../../../../utils/paths')
const {
  version: currentKitVersion
} = require(path.join(packageDir, 'package.json'))
const { getConfig } = require('../../../../config')

const url = `${getConfig().npiApiBaseUrl}/v1/messages/npi-govuk/${encodeURIComponent(currentKitVersion)}`
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
      res.render('index', {
        ...getModel('Home', req),
        messages
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
