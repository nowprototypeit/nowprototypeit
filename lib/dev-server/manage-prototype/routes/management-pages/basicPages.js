const http = require('node:http')
const fsp = require('node:fs').promises
const path = require('node:path')

const { getPageNavLinks, awaitOrResolveWithDefault } = require('../../utils')
const { requestHttpsJson } = require('../../../../utils/requestHttps')
const kitVersion = require('../../../../../package.json').version
const { getConfig } = require('../../../../config')
const { findPagesInUsersKit } = require('../../../../utils')
const { projectDir } = require('../../../../utils/paths')
const { verboseLog } = require('../../../../utils/verboseLogger')
const { addShutdownFn } = require('../../../../utils/shutdownHandlers')
const { prepareMessagesFromApi } = require('../../utils/prepare-messsages-from-api')

const url = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/messages/npi/${encodeURIComponent(kitVersion)}`
let messagesPromise = null

function updateMessages () {
  messagesPromise = requestHttpsJson(url, {}).then(prepareMessagesFromApi).catch((e) => {
    verboseLog('Error fetching messages from NPI API with URL', url)
    verboseLog('Error fetching messages from NPI API', e)
  })
}

const messagesPollInterval = setInterval(updateMessages, 20 * 60 * 1000)
addShutdownFn(() => {
  clearInterval(messagesPollInterval)
})
updateMessages()

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
      const messages = await awaitOrResolveWithDefault(messagesPromise, 500, null)
      res.render('index', {
        ...getModel('Home', req),
        messages,
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

    router.get('/version', async (req, res) => {
      const resultParts = ['<!DOCTYPE html><html><head><title>Kit Version</title></head><body>']
      resultParts.push(`<p id="kit-version">${kitVersion}</p>`)
      resultParts.push('<p id="npi-dependency">')
      await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8').then((packageJson) => {
        const deps = JSON.parse(packageJson).dependencies
        resultParts.push(deps.nowprototypeit)
      }).catch(() => {
        resultParts.push('Error reading package.json')
      })
      resultParts.push('</p></body></html>')
      res.send(resultParts.join(''))
    })
  }
}
