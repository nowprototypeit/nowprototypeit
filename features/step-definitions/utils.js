const http = require('node:http')
const url = require('node:url')

const net = require('node:net')
const fsp = require('node:fs').promises
const { Builder, By } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const firefox = require('selenium-webdriver/firefox')
const path = require('path')
const os = require('os')
const uuid = require('uuid')
const { fork, execv2 } = require('../../lib/exec')
const exec = execv2
const chaiPromise = import('chai')

let currentSharedKitAndBrowser
const allKits = []
const allBrowsers = []

async function cleanupEverything (deleteKit = true) {
  await Promise.all([
    ...allKits.map(async (kitPromise) => {
      const kit = await kitPromise
      await kit.close()
      if (deleteKit) {
        await kit.cleanup()
      }
    }),
    ...allBrowsers.map(async (browser) => {
      await (await browser).quit()
    })
  ])
}

async function findAvailablePort () {
  return await new Promise((resolve) => {
    let port
    const tmpServer = net.createServer(function (sock) {
      sock.end('Hello world\n')
    })
    tmpServer.listen(0, function () {
      port = tmpServer.address().port
      tmpServer.close(() => {
        resolve(port)
      })
    })
  })
}

async function startKit (config = {}) {
  const dir = config.dir ?? path.join(os.tmpdir(), `nowprototypeit-govuk-cucumberjs-${uuid.v4()}`)
  const nextRestartListeners = []

  if (config.kitDependency) {
    const dep = config.kitDependency
    const command = `npx -y --package="${dep}" now-prototype-it-govuk create --version=${dep} ${dir}`
    console.log('kit create command:', command)
    await exec(command, {
      env: { ...process.env }
    })
  } else {
    const binCli = config.binCli ?? path.join(__dirname, '../../bin/cli')
    const kitCreationThread = fork(binCli, {
      passThroughEnv: true,
      args: config.createArgs ?? ['create', '--version=local', dir]
    })
    await kitCreationThread.finishedPromise
  }
  let finishedRes
  const kitStartedPromise = new Promise((resolve) => {
    finishedRes = resolve
  })

  const kitPort = await findAvailablePort()
  const kitThread = fork(path.join(dir, 'node_modules', '@nowprototypeit', 'govuk', 'bin', 'cli'), {
    hideStdout: process.env.SHOW_KIT_STDIO !== 'true',
    passThroughEnv: true,
    neverRejectFinishedPromise: true,
    env: {
      PORT: kitPort
    },
    cwd: dir,
    args: ['dev'],
    stdoutHandlers: {
      data: (data) => {
        const str = data.toString()
        if (str.includes('The Prototype Kit is now running at:')) {
          finishedRes()
        }
        if (str.includes('Your prototype was restarted.')) {
          while (nextRestartListeners.length > 0) {
            nextRestartListeners.pop()()
          }
        }
      }
    }
  })

  await kitStartedPromise.catch(e => {})

  const returnValue = {
    dir,
    url: `http://localhost:${kitPort}`,
    addNextRestartListener: (listener) => {
      nextRestartListeners.push(listener)
    },
    close: async () => {
      await kitThread.close()
    },
    cleanup: async () => {
      const shouldCleanUpDir = config.shouldCleanupDir ?? !config.dir
      if (shouldCleanUpDir) {
        await fsp.rm(dir, { recursive: true })
      }
      if (config.afterCleanup) {
        config.afterCleanup()
      }
    },
    sendStdin: (str) => {
      kitThread.stdio.stdin.write(str + '\n')
    }
  }
  allKits.push(returnValue)
  return returnValue
}

async function getBrowser (config = {}) {
  let baseUrl
  const builder = new Builder()
    .forBrowser(process.env.BROWSER_NAME || 'chrome')
  if (process.env.SHOW_BROWSER !== 'true') {
    const screen = {
      width: 1080,
      height: 1080
    }
    builder.setChromeOptions(new chrome.Options().addArguments('--headless').windowSize(screen))
    builder.setFirefoxOptions(new firefox.Options().addArguments('--headless').windowSize(screen))
  }
  const driver = builder.build()
  const getFullUrl = (url) => url.startsWith('/') && baseUrl ? baseUrl + url : url
  allBrowsers.push(driver)
  const self = {
    driver,
    getTitle: () => driver.getTitle(),
    setBaseUrl: (newBaseUrl) => {
      baseUrl = newBaseUrl
    },
    getFullUrl,
    openUrl: async (url) => {
      const fullUrl = getFullUrl(url)
      if (process.env.SHOW_URL_OPENINGS === 'true') {
        console.log('Opening URL', fullUrl)
      }
      return await driver.get(fullUrl)
    },
    refresh: async () => {
      await driver.navigate().refresh()
    },
    queryClass: async (className) => {
      return await driver.findElements(By.className(className))
    },
    queryId: async (id) => {
      return await driver.findElement(By.id(id))
    },
    queryTag: async (tag) => {
      return await driver.findElements(By.tagName(tag))
    },
    close: async () => {
      await driver.quit()
      if (config.afterCleanup) {
        config.afterCleanup()
      }
    }
  }
  self.getPluginDetails = async () => {
    const pluginElements = await Promise.all(await self.queryClass('nowprototypeit-manage-prototype-plugin-list__item'))
    return await Promise.all(pluginElements.map(async elem => ({
      name: await (await elem.findElement(By.className('nowprototypeit-manage-prototype-plugin-list-plugin-name'))).getText(),
      scope: await (await elem.findElements(By.className('nowprototypeit-manage-prototype-plugin-list-plugin-scope')))[0]?.getText(),
      hasInstalledFlag: (await elem.findElements(By.className('nowprototypeit-manage-prototype-plugin-list-item-installed-details'))).length > 0
    })))
  }
  ;['wait'].forEach(key => {
    self[key] = driver[key].bind(driver)
  })
  return self
}

async function getPrototypeKit ({ afterCleanup, kitDependency } = {}) {
  return await startKit({ afterCleanup, kitDependency })
}

async function getPrototypeKitAndBrowser () {
  if (currentSharedKitAndBrowser) {
    return { ...currentSharedKitAndBrowser, isReused: true }
  }
  const combinationForSharing = {}
  const cleanup = async () => {
    if (currentSharedKitAndBrowser === combinationForSharing) {
      currentSharedKitAndBrowser = undefined
    }
  }
  const [kit, browser] = await Promise.all([
    getPrototypeKit({
      afterCleanup: cleanup,
      kitDependency: process.env.TEST_KIT_DEPENDENCY
    }),
    getBrowser({
      afterCleanup: cleanup
    })
  ])
  browser.setBaseUrl(kit.url)
  combinationForSharing.kit = await kit
  combinationForSharing.browser = await browser
  currentSharedKitAndBrowser = combinationForSharing
  return { ...combinationForSharing, isReused: false }
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
    const timeoutCallback = async () => {
      const result = await isCorrect()
      if (result) {
        return resolve()
      }
      if (Date.now() + delayBetweenRetries > timeoutTimestamp) {
        return errorCallback(reject)
      }
      setupTimeout()
    }

    function setupTimeout () {
      setTimeout(timeoutCallback, delayBetweenRetries)
    }

    setupTimeout()
  })
}

const timeoutMultiplier = Number(process.env.TIMEOUT_MULTIPLIER || path.sep === '/' ? 1 : 3)

module.exports = {
  cleanupEverything,
  cleanupAllBrowsers: async function () {
    await Promise.all(allBrowsers.map(async (browser) => {
      await (await browser).quit()
    }))
  },
  getPrototypeKitAndBrowser,
  expect: async function () {
    const chai = await chaiPromise
    return chai.expect(...arguments)
  },
  makeGetRequest,
  waitForConditionToBeMet,
  timeoutMultiplier,
  kitStartTimeout: { timeout: (process.env.TEST_KIT_DEPENDENCY ? 90 : 30) * 1000 * timeoutMultiplier },
  pluginActionTimeout: { timeout: 40 * 1000 * timeoutMultiplier },
  pluginActionPageTimeout: { timeout: 20 * 1000 * timeoutMultiplier },
  mediumActionTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  pageRefreshTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  intentionalDelayTimeout: { timeout: 60 * 60 * 1000 },
  styleBuildTimeout: { timeout: 30 * 1000 * timeoutMultiplier }
}
