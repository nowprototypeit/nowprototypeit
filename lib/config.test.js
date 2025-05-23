/* eslint-env jest */

// core dependencies
const path = require('path')

// npm dependencies
const fse = require('fs-extra')

// local dependencies
const { appDir } = require('./utils/paths')
const config = require('./config')

const appConfig = path.join(appDir, 'config.json')
const actualExistsSync = fse.existsSync
const originalEnvironmentVariables = process.env

describe('config', () => {
  const defaultConfig = Object.freeze({
    port: 3000,
    useAuth: true,
    useHttps: true,
    useAutoStoreData: true,
    autoReloadPages: true,
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    passwordKeys: '',
    passwordMissing: false,
    passwords: [],
    onGlitch: false,
    nowPrototypeItAPIBaseUrl: 'https://api.nowprototype.it',
    showJsonErrors: false,
    showPrereleases: false,
    verbose: false,
    showPluginDebugInfo: false,
    showPluginDowngradeButtons: false,
    turnOffFunctionCaching: false,
    getPluginSpecificConfig: expect.any(Function),
    editInBrowser: false,
    respectFileExtensions: false,
    hostingEnabled: false
  })

  const mergeWithDefaults = (config) => Object.assign({}, defaultConfig, config)

  let testScope
  beforeEach(() => {
    testScope = {
      processEnvBackup: Object.assign({}, process.env),
      configJs: {},
      configFileExists: true
    }
    jest.spyOn(fse, 'readJsonSync').mockImplementation(() => {
      return testScope.configJs
    })

    jest.spyOn(fse, 'existsSync').mockImplementation(
      path => {
        if (path === appConfig) {
          return testScope.configFileExists
        }
        return actualExistsSync(path)
      }
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
    process.env = testScope.processEnvBackup
  })

  it('uses defaults when no config file exists', () => {
    testScope.configFileExists = false

    expect(config.getConfig()).toStrictEqual(defaultConfig)
  })

  it('allows the user to set autoReloadPages', () => {
    testScope.configJs = {
      autoReloadPages: false
    }

    expect(config.getConfig()).toStrictEqual(mergeWithDefaults({
      autoReloadPages: false
    }))
  })

  it('allows the user to set some values in config and others in environment variables', () => {
    testScope.configJs = {
      useAuth: true
    }

    process.env.AUTO_RELOAD_PAGES = 'false'

    expect(config.getConfig()).toStrictEqual(mergeWithDefaults({
      useAuth: true,
      autoReloadPages: false
    }))
  })

  it('Sets the port to an number not a string', () => {
    process.env.PORT = '1234'

    expect(config.getConfig()).toStrictEqual(mergeWithDefaults({
      port: 1234
    }))
  })

  describe('onGlitch', () => {
    beforeEach(() => {
      process.env = {}
    })

    afterEach(() => {
      process.env = originalEnvironmentVariables
    })

    it('returns false if envvar PROJECT_REMIX_CHAIN is not set', () => {
      expect(config.getConfig().onGlitch).toBe(false)
    })

    it('returns true if envvar PROJECT_REMIX_CHAIN is set', () => {
      process.env.PROJECT_REMIX_CHAIN = '["dead-beef"]'
      expect(config.getConfig().onGlitch).toBe(true)
    })
  })

  describe('getNodeEnd', () => {
    beforeEach(() => {
      process.env = {}
    })

    afterEach(() => {
      process.env = originalEnvironmentVariables
    })

    it('returns the value of NODE_ENV', () => {
      process.env.NODE_ENV = 'production'
      expect(config.getConfig().isProduction).toBe(true)

      process.env.NODE_ENV = 'test'
      expect(config.getConfig().isProduction).toBe(false)
    })

    it('defaults to development if NODE_ENV is not set or empty', () => {
      expect(config.getConfig().isProduction).toBe(false)

      process.env.NODE_ENV = ''
      expect(config.getConfig().isProduction).toBe(false)
    })

    it('always returns a lower-case string', () => {
      process.env.NODE_ENV = 'FOOBAR'
      expect(config.getConfig().isProduction).toBe(false)
    })

    it('returns production if running on Glitch and NODE_ENV not set or empty', () => {
      process.env.PROJECT_REMIX_CHAIN = '["dead-beef"]'
      expect(config.getConfig().isProduction).toBe(true)

      process.env.NODE_ENV = ''
      expect(config.getConfig().isProduction).toBe(true)
    })
  })
})
