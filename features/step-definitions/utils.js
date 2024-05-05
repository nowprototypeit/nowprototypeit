const http = require('node:http')

const url = require('node:url')
const net = require('node:net')
const fs = require('node:fs')
const fsp = fs.promises
const path = require('path')
const os = require('os')

const uuid = require('uuid')
const chaiPromise = import('chai')
const { Builder, By } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const firefox = require('selenium-webdriver/firefox')
const { sleep } = require('../../lib/utils')
const { fork, execv2 } = require('../../lib/exec')
const execv1 = require('../../lib/exec').exec
const exec = execv2
const { flattenArray } = require('../../lib/utils/arrayTools')

const kitAndBrowserStore = (() => {
  const store = {}
  const getKeyFromOptions = options => JSON.stringify(options || {})

  return {
    get: (options) => store[getKeyFromOptions(options)],
    set: (kitAndBrowser, options) => {
      store[getKeyFromOptions(options)] = kitAndBrowser
    },
    remove: (options) => delete store[getKeyFromOptions(options)],
    getAllKits: () => flattenArray(Object.values(store).map(({ kit }) => kit)),
    getAllBrowsers: () => flattenArray(Object.values(store).map(({ browser }) => browser))
  }
})()

async function cleanupEverything (deleteKit = true) {
  await Promise.all([
    ...kitAndBrowserStore.getAllKits().map(async (kitPromise) => {
      const kit = await kitPromise
      if (kit.resetPromise) {
        await kit.resetPromise
      }
      await kit.close()
      if (deleteKit) {
        await kit.cleanup()
      }
    }),
    ...kitAndBrowserStore.getAllBrowsers().map(async (browser) => {
      const theBrowser = await browser
      if (!theBrowser) {
        return
      }
      await theBrowser.close()
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
  const nextKitRestartListeners = []
  const nextManagementAppRestartListeners = []

  const additionalCliArgs = []

  if (config.variantPluginName) {
    additionalCliArgs.push(`--variant=${config.variantPluginName}`)
  }

  if (config.variantPluginDependency) {
    additionalCliArgs.push(`--variant-dependency=${config.variantPluginDependency}`)
  }

  if (config.kitDependency) {
    const dep = config.kitDependency
    const command = 'npx'
    const args = ['-y', `-package=${dep}`, 'nowprototypeit', 'create', ...additionalCliArgs, `--version=${dep}`, dir]
    const execResult = exec({
      command,
      args
    }, {
      env: { ...process.env },
      hideStdout: process.env.SHOW_KIT_STDIO !== 'true',
      hideStderr: process.env.SHOW_KIT_STDIO !== 'true'
    })
    await execResult.finishedPromise
  } else {
    const binCli = config.binCli ?? path.join(__dirname, '../../bin/cli')
    const args = config.createArgs ?? ['create', ...additionalCliArgs, '--version=local', dir]
    const kitCreationThread = fork(binCli, {
      passThroughEnv: true,
      hideStdout: process.env.SHOW_KIT_STDIO !== 'true',
      hideStderr: process.env.SHOW_KIT_STDIO !== 'true',
      args
    })
    await kitCreationThread.finishedPromise
  }
  let finishedRes
  const kitStartedPromise = new Promise((resolve) => {
    finishedRes = resolve
  })

  const kitPort = await findAvailablePort()
  const pathToCli = path.join(dir, 'node_modules', 'nowprototypeit', 'bin', 'cli')
  if (!fs.existsSync(pathToCli)) {
    throw new Error('Could not find the CLI at ' + pathToCli)
  }
  const kitThread = fork(pathToCli, {
    hideStdout: process.env.SHOW_KIT_STDIO !== 'true',
    hideStderr: process.env.SHOW_KIT_STDIO !== 'true',
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
          while (nextKitRestartListeners.length > 0) {
            nextKitRestartListeners.pop()()
          }
        }
        if (str.includes('Prototype Management app restarted.')) {
          while (nextManagementAppRestartListeners.length > 0) {
            nextManagementAppRestartListeners.pop()()
          }
        }
      }
    }
  })

  await kitStartedPromise.catch(e => {
  })

  const returnValue = {
    dir,
    url: `http://localhost:${kitPort}`,
    addNextKitRestartListener: (listener) => {
      nextKitRestartListeners.push(listener)
    },
    addNextManagementAppRestartListener: (listener) => {
      nextManagementAppRestartListeners.push(listener)
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
    },
    reset: async () => {
      await resetKitSessions(returnValue)
      await resetKit(returnValue)
    },
    startupConfig: JSON.stringify(config, null, 2),
    id: uuid.v4()
  }
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
  const self = {
    driver,
    id: uuid.v4(),
    getTitle: () => driver.getTitle(),
    setBaseUrl: (newBaseUrl) => {
      baseUrl = newBaseUrl
    },
    getFullUrl,
    openUrl: async (url, maxTimeout = standardTimeout.timeout - 500) => {
      let attemptCount = 0
      const start = Date.now()
      const fullUrl = getFullUrl(url)
      if (process.env.SHOW_URL_OPENINGS === 'true') {
        console.log('Opening URL', fullUrl)
      }
      let succeeded = false
      let lastKnownError
      while (!succeeded && Date.now() - start < maxTimeout) {
        attemptCount++
        await driver.get(fullUrl)
          .then(() => {
            succeeded = true
          })
          .catch(e => {
            console.log(`Caught error [${e.type || e}] after [${attemptCount}] attempts`)
            lastKnownError = e
            return sleep(200)
          })
      }
      if (!succeeded && lastKnownError) {
        console.log(`failed to load [${url}] after [${attemptCount}] attempts with timeout [${maxTimeout}]`)
        throw lastKnownError
      }
    },
    refresh: async () => {
      await driver.navigate().refresh()
    },
    queryClass: async (className) => {
      return await driver.findElements(By.className(className))
    },
    queryCss: async (cssSelector) => {
      return await driver.findElements(By.css(cssSelector))
    },
    queryId: async (id) => {
      return await driver.findElement(By.id(id))
    },
    queryTag: async (tag) => {
      return await driver.findElements(By.tagName(tag))
    },
    queryAttribute: async (attrName, attrValue) => {
      return await driver.findElements(By.xpath(`//*[@${attrName}="${attrValue}"]`))
    },
    setWindowSizeToPageSize: async () => {
      try {
        const height = await driver.executeScript('return document.body.parentNode.scrollHeight')
        const width = await driver.executeScript('return document.body.parentNode.scrollWidth')
        await driver.manage().window().setSize({ width, height })
      } catch (e) {
        console.error('failed to set window size:')
        console.error(e)
      }
    },
    close: async () => {
      try {
        await driver.quit()
      } catch (e) {
        if (e.type !== 'NoSuchSessionError') {
          throw e
        }
      }
      if (config.afterCleanup) {
        config.afterCleanup()
      }
    },
    kitStartConfig: config.kitStartConfig
  }
  self.getPluginDetails = async () => {
    const pluginElements = await Promise.all(await self.queryClass('nowprototypeit-manage-prototype-plugin-list__item'))
    return await Promise.all(pluginElements.map(async elem => ({
      name: await (await elem.findElement(By.className('nowprototypeit-manage-prototype-plugin-list-plugin-name'))).getText(),
      scope: await (await elem.findElements(By.className('nowprototypeit-manage-prototype-plugin-list-plugin-scope')))[0]?.getText(),
      hasInstalledFlag: (await elem.findElements(By.className('nowprototypeit-manage-prototype-plugin-list-item-installed-details'))).length > 0,
      updateAvailable: (await elem.findElements(By.className('nowprototypeit-info-box'))).length > 0
    })))
  }
  ;['wait'].forEach(key => {
    self[key] = driver[key].bind(driver)
  })
  return self
}

async function getPrototypeKitAndBrowser (options = {}) {
  const currentSharedKitAndBrowser = kitAndBrowserStore.get(options)
  if (currentSharedKitAndBrowser) {
    let isReset = false
    if (currentSharedKitAndBrowser.kit.resetPromise) {
      await currentSharedKitAndBrowser.kit.resetPromise
      isReset = true
    }
    return { ...currentSharedKitAndBrowser, isReused: true, isReset }
  }
  const combinationForSharing = {}
  const cleanup = async () => {
    kitAndBrowserStore.remove(options)
  }
  const kitStartConfig = {
    afterCleanup: cleanup,
    kitDependency: options.kitDependency || process.env.TEST_KIT_DEPENDENCY,
    variantPluginName: options.variantPluginName,
    variantPluginDependency: options.variantPluginDependency
  }
  const [kit, browser] = await Promise.all([
    startKit(kitStartConfig),
    getBrowser({
      afterCleanup: cleanup,
      kitStartConfig: JSON.stringify(kitStartConfig, null, 2)
    })
  ])
  combinationForSharing.kit = kit
  combinationForSharing.browser = browser
  browser.setBaseUrl(kit.url)
  kitAndBrowserStore.set(combinationForSharing, options)
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
  const { kit, browser, isReused, isReset } = await getPrototypeKitAndBrowser(options)

  if (isReused && !isReset) {
    console.log('reused kit was not previously reset, resetting now')
    await resetKit(kit)
  }

  that.kit = kit
  that.browser = browser

  if (!that.browser) {
    throw new Error('No browser set up, something is wrong')
  }

  if (!that.kit) {
    throw new Error('No kit set up, something is wrong')
  }
}

async function resetKitSessions (kit) {
  const sessionsDir = path.join(kit.dir, '.tmp', 'sessions')
  if (fs.existsSync(sessionsDir)) {
    await fsp.rm(sessionsDir, { recursive: true })
  }
}

async function resetKit (kit) {
  const runCommand = async (command) => {
    let result = ''
    const stdHandler = (data) => {
      result += data.toString()
    }
    try {
      await execv1(command, {
        cwd: kit.dir
      }, stdHandler)
      return result
    } catch (e) {
      console.error('Failed to run command', command)
      console.error(e)
      throw e
    }
  }

  let resetPromiseResolve
  kit.resetPromise = new Promise((resolve) => {
    resetPromiseResolve = resolve
  })

  const status = await runCommand('git status')

  await runCommand('git add -A .')
  await runCommand('git reset --hard HEAD')

  if (status.includes('package.json')) {
    await runCommand('npm install')
    await runCommand('npm prune')

    const restartPromise = Promise.all([
      new Promise((resolve) => {
        kit.addNextKitRestartListener(() => {
          resolve()
        })
      }),
      new Promise((resolve) => {
        kit.addNextKitRestartListener(() => {
          resolve()
        })
      })
    ])
    kit.sendStdin('rs')

    await restartPromise

    resetPromiseResolve()
  } else {
    resetPromiseResolve()
  }
}

const initialTimeoutMultiplier = process.env.TIMEOUT_MULTIPLIER || path.sep === '/' ? 1 : 3
const additionalTimeoutMultiplier = Number(process.env.ADDITIONAL_TIMEOUT_MULTIPLIER ? process.env.ADDITIONAL_TIMEOUT_MULTIPLIER : 1)
const timeoutMultiplier = initialTimeoutMultiplier * additionalTimeoutMultiplier

const standardTimeout = { timeout: 5 * 1000 * timeoutMultiplier }
module.exports = {
  cleanupEverything,
  expect: async function () {
    const chai = await chaiPromise
    return chai.expect(...arguments)
  },
  makeGetRequest,
  waitForConditionToBeMet,
  setupKitAndBrowserForTestScope,
  timeoutMultiplier,
  kitStartTimeout: { timeout: (process.env.TEST_KIT_DEPENDENCY ? 90 : 40) * 1000 * timeoutMultiplier },
  standardTimeout,
  tinyTimeout: { timeout: 0.5 * 1000 * timeoutMultiplier },
  pluginActionTimeout: { timeout: 60 * 1000 * timeoutMultiplier },
  pluginActionPageTimeout: { timeout: 20 * 1000 * timeoutMultiplier },
  mediumActionTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  pageRefreshTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  intentionalDelayTimeout: { timeout: 60 * 60 * 1000 },
  styleBuildTimeout: { timeout: 30 * 1000 * timeoutMultiplier }
}
