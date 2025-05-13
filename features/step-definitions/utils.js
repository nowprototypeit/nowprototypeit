const http = require('node:http')

const url = require('node:url')
const fs = require('node:fs')
const fsp = fs.promises
const path = require('path')

const chaiPromise = import('chai')
const { flattenArray } = require('../../lib/utils/arrayTools')
const { getBrowser } = require('./setup-helpers/browser')
const { setupKit } = require('./setup-helpers/kit')

const kitAndBrowserStore = (() => {
  const store = {}
  const getKeyFromOptions = options => JSON.stringify(options || {})

  return {
    get: (options) => store[getKeyFromOptions(options)],
    set: (kitAndBrowser, options) => {
      const key = getKeyFromOptions(options)
      kitAndBrowser.kit.storageKey = key
      store[key] = kitAndBrowser
    },
    remove: (options) => delete store[getKeyFromOptions(options)],
    removeByKey: (key) => delete store[key],
    getAllKits: () => flattenArray(Object.values(store).map(({ kit }) => kit)),
    getAllBrowsers: () => flattenArray(Object.values(store).map(({ browser }) => browser))
  }
})()

async function removeKit (kit) {
  const key = kit.storageKey
  await kit.close()
  await kit.cleanup()
  kitAndBrowserStore.removeByKey(key)
}

function makeGetRequest (requestUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(requestUrl)

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET'
    }

    const req = http.request(options, (res) => {
      let body = []

      res.on('data', (chunk) => {
        body.push(chunk)
      })

      res.on('end', () => {
        body = Buffer.concat(body)
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        })
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

function waitForConditionToBeMet (timeoutDeclaration, isCorrect, errorCallback) {
  return new Promise((resolve, reject) => {
    const maxTimeout = timeoutDeclaration.timeout - 500
    const timeoutTimestamp = Date.now() + maxTimeout

    const delayBetweenRetries = 150
    let lastRunError = null
    const timeoutCallback = async () => {
      let result = false
      try {
        result = await isCorrect()
      } catch (e) {
        lastRunError = e
      }
      if (result) {
        return resolve()
      }
      if (Date.now() + delayBetweenRetries > timeoutTimestamp) {
        if (lastRunError) {
          return reject(lastRunError)
        }
        if (errorCallback) {
          return errorCallback(reject)
        }
        reject(new Error('Timeout waiting for condition to be met'))
      }
      setupTimeout()
    }

    function setupTimeout () {
      setTimeout(timeoutCallback, delayBetweenRetries)
    }

    setupTimeout()
  })
}

async function setupKitAndBrowserForTestScope (that, options) {
  that.browser = that.browser || await getBrowser({
    afterCleanup: () => {
      that.browser = null
    }
  })
  that.kit = await setupKit(options)
  that.browser.setBaseUrl(that.kit.url)
  if (!that.browser) {
    throw new Error('No browser set up, something is wrong')
  }

  if (!that.kit) {
    throw new Error('No kit set up, something is wrong')
  }

  if (process.env.LOG_KIT_DIR === 'true') {
    console.log('Kit running in dir', that.kit.dir)
  }
}

async function readFixtureFile (relativeFilePath) {
  const filePath = path.join(__dirname, '..', 'fixtures', relativeFilePath)
  return await fsp.readFile(filePath, 'utf8')
}

async function readPrototypeFile (kit, relativeFilePath) {
  const filePath = path.join(kit.dir, relativeFilePath)
  return await fsp.readFile(filePath, 'utf8')
}

async function writePrototypeFile (kit, relativeFilePath, fileContents) {
  const filePath = path.join(kit.dir, relativeFilePath)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, fileContents, 'utf8')
}
module.exports = {
  expect: async function () {
    const chai = await chaiPromise
    return chai.expect(...arguments)
  },
  makeGetRequest,
  waitForConditionToBeMet,
  setupKitAndBrowserForTestScope,
  removeKit,
  readFixtureFile,
  readPrototypeFile,
  writePrototypeFile
}
