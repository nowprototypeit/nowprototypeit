const http = require('http')
const path = require('path')
const fsp = require('fs').promises
const { getReloaderScript, warmUpReloaderScript, getPageNavLinks } = require('../utils')
const {
  getErrorModelFromStderr,
  getErrorModelFromErrObj,
  getErrorModelFromException
} = require('../../../utils/errorModel')
const { startPerformanceTimer, endPerformanceTimer } = require('../../../utils/performance')
const { findPagesInUsersKit } = require('../../../utils')
const { getPathToDesignSystemAssets } = require('../build')
const userConfig = require('../../../config')

module.exports = {
  proxyRemainingRequests: (app, config) => {
    warmUpReloaderScript()

    function insertAfterTag (html, tag, content) {
      let insertStart = 0
      const bodyStart = html.indexOf('<' + tag)
      if (bodyStart > -1) {
        insertStart = html.indexOf('>', bodyStart) + 1
      }
      const before = html.substring(0, insertStart)
      const after = html.substring(insertStart)
      return [before, content, after].join('')
    }

    async function getReloaderHtml () {
      const reloaderScript = await getReloaderScript()
      return `<script>${reloaderScript}</script>`
    }

    app.use(async (req, res) => {
      const fullRequestTimer = startPerformanceTimer()
      const requestTimestamp = Date.now()
      const reloaderHtml = await getReloaderHtml()

      async function sendResponse ({
        response,
        resultBuffer,
        statusCode,
        statusMessage,
        headers
      }) {
        if (statusCode === 404 && req.originalUrl.startsWith('/favicon.ico')) {
          try {
            res.send(await fsp.readFile(path.join(getPathToDesignSystemAssets(), 'icons', 'favicon.ico')))
          } catch (e) {
            res.send('')
          }
          endPerformanceTimer('proxyRemainingRequests (favicon 404)', fullRequestTimer)
          return
        }

        if (statusCode === 404 && headers['content-type'].startsWith('application/json') && getJsonFromResponse().errorToBeDisplayedNicely === true && getJsonFromResponse().is404) {
          if (req.originalUrl.split('?')[0] === '/') {
            return res.render('home', {
              isRunningFromManagePrototype: true,
              defaultViewExtension: 'njk',
              foundPages: findPagesInUsersKit()
            })
          }
          res.status(statusCode)
          return res.render('not-found')
        }

        res.status(statusCode)

        function sendHeaders () {
          Object.keys(headers).forEach(headerKey => {
            res.setHeader(headerKey, headers[headerKey])
          })
        }

        function getJsonFromResponse () {
          try {
            return JSON.parse(resultBuffer.toString())
          } catch (e) {
            return {}
          }
        }

        if (statusCode === 500 && headers['content-type'].startsWith('application/json') && getJsonFromResponse().errorToBeDisplayedNicely === true) {
          const model = {
            fatal: false,
            ...await getErrorModelFromErrObj(getJsonFromResponse()),
            headerSubNavItems: getPageNavLinks(req).map(x => ({
              ...x,
              isCurrentPage: false
            }))
          }
          endPerformanceTimer('proxyRemainingRequests (500, error to be displayed nicely)', fullRequestTimer)
          return res.render('error', model)
        }

        sendHeaders()
        if (userConfig.getConfig().autoReloadPages && headers['content-type']?.startsWith('text/html')) {
          res.send(insertAfterTag(resultBuffer.toString(), 'head', reloaderHtml))
          endPerformanceTimer('proxyRemainingRequests (text/html with refresher)', fullRequestTimer)
        } else if (isBufferBinary(resultBuffer)) {
          res.end(resultBuffer, 'binary')
          endPerformanceTimer('proxyRemainingRequests (binary)', fullRequestTimer)
        } else {
          res.send(resultBuffer.toString())
          endPerformanceTimer('proxyRemainingRequests (string)', fullRequestTimer)
        }
      }

      async function sendError (err) {
        if (err.code === 'ECONNRESETT') {
          res.status(500).render('error', await getErrorModelFromStderr('Your prototype restarted while this page was loading, please try again.', requestTimestamp))
        } else {
          res.status(500).render('error', await getErrorModelFromException(err, requestTimestamp))
        }
        endPerformanceTimer('proxyRemainingRequests (error)', fullRequestTimer)
      }

      if (config.currentKitPort) {
        await proxyRequest(req, sendResponse, sendError, config)
      } else if (config.lastKnownError) {
        res.render('error', {
          fatal: true,
          ...await getErrorModelFromStderr(config.lastKnownError.stderr)
        })
      } else {
        res.render('kit-not-started')
      }
    })
  }
}

async function proxyRequest (req, sendResponse, sendError, config) {
  const reqHeaders = req.headers
  const options = {
    port: config.currentKitPort,
    hostname: 'localhost',
    path: req.originalUrl,
    method: req.method,
    headers: reqHeaders
  }
  let statusCode
  let statusMessage
  let headers
  const chunks = []
  const proxyRequest = http.request(options, response => {
    response
      .on('end', async () => {
        const resultBuffer = Buffer.concat(chunks)
        await sendResponse({
          response,
          resultBuffer,
          statusCode,
          statusMessage,
          headers
        })
      })
  })
    .on('response', response => {
      statusCode = response.statusCode
      statusMessage = response.statusMessage
      headers = { ...response.headers }
      response.on('data', data => {
        chunks.push(data)
      })
    })
    .on('error', err => {
      sendError(err)
      console.error('Error from HTTP response: ', err.message || err)
    })

  req.pipe(proxyRequest)
}

// From Jetbrains AI Assistant
function isBufferBinary (buffer) {
  const timer = startPerformanceTimer()
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] > 127 || (buffer[i] < 32 && buffer[i] !== 10 && buffer[i] !== 13)) {
      endPerformanceTimer('isBufferBinary (true)', timer)
      return true
    }
  }
  endPerformanceTimer('isBufferBinary (false)', timer)
  return false
}
