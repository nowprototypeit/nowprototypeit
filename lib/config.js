const { startPerformanceTimer, endPerformanceTimer } = require('./utils/performance')
const performanceTimer = startPerformanceTimer()
// core dependencies
const path = require('path')

// npm dependencies
const fse = require('fs-extra')
const { isString } = require('lodash')

// local dependencies
const { appDir } = require('./utils/paths')

const appConfigPath = path.join(appDir, 'config.json')
const validEnvironmentVariableRegex = /^[_a-zA-Z][_a-zA-Z0-9]*$/

function getConfigFromFile (swallowError = true) {
  const configFileExists = fse.existsSync(appConfigPath)
  if (configFileExists) {
    try {
      return fse.readJsonSync(appConfigPath)
    } catch (e) {
      if (swallowError) {
        console.error(`Could not load config from ${appConfigPath}, please check your JSON is well formed.`)
      } else {
        throw e
      }
    }
  }
  return {}
}

const asNumber = inputString => isString(inputString) ? Number(inputString) : inputString
const asBoolean = inputString => isString(inputString) ? inputString.toLowerCase() === 'true' : inputString
const asString = inputString => inputString

// Are we running on Glitch.com?
function onGlitch () {
  // there isn't an official way to check, but this was recommended
  // https://support.glitch.com/t/detect-if-app-is-running-on-glitch/3120
  return Boolean(process.env.PROJECT_REMIX_CHAIN)
}

// Get a normalised form of NODE_ENV

//
// Returns a lower-case string representing the environment the node.js app
// is running in. Normally this will be one of `production`, `development`,
// or `test`, although it can be any lower-case string. In most
// circumstances the value is derived from the environment variable
// NODE_ENV, defaulting to `development` if that is not set.
function getNodeEnv () {
  const glitchEnv = onGlitch() ? 'production' : false // Glitch doesn't set NODE_ENV, but we want to treat it as production
  const env = (process.env.NODE_ENV || glitchEnv || 'development').toLowerCase()
  return env
}

function getConfig (config, swallowError = true) {
  const timer = startPerformanceTimer()
  config = config || { ...getConfigFromFile(swallowError) }

  const overrideOrDefault = (configName, envName, processor, defaultValue) => {
    const environmentValue = process.env[envName]
    if (environmentValue !== undefined) {
      config[configName] = processor(environmentValue)
    } else if (config[configName] !== undefined) {
      config[configName] = processor(config[configName])
    } else if (defaultValue !== undefined && config[configName] === undefined) {
      config[configName] = defaultValue
    }
  }

  config.onGlitch = onGlitch()
  config.isProduction = getNodeEnv() === 'production'
  config.isDevelopment = getNodeEnv() === 'development'
  config.isTest = getNodeEnv() === 'test' || process.env.IS_INTEGRATION_TEST === 'true'

  // basic
  overrideOrDefault('useAutoStoreData', 'USE_AUTO_STORE_DATA', asBoolean, true)
  overrideOrDefault('port', 'PORT', asNumber, 3000)
  overrideOrDefault('showPrereleases', 'SHOW_PRERELEASES', asBoolean, false)

  // advanced
  overrideOrDefault('useAuth', 'USE_AUTH', asBoolean, true)
  overrideOrDefault('useHttps', 'USE_HTTPS', asBoolean, true)
  overrideOrDefault('autoReloadPages', 'AUTO_RELOAD_PAGES', asBoolean, true)
  overrideOrDefault('verbose', 'VERBOSE', asBoolean, false)
  overrideOrDefault('passwordKeys', 'PASSWORD_KEYS', asString, '')

  // experiments
  overrideOrDefault('respectFileExtensions', 'RESPECT_FILE_EXTENSIONS', asBoolean, false)
  overrideOrDefault('editInBrowser', 'EDIT_IN_BROWSER', asBoolean, false)
  overrideOrDefault('showPluginDowngradeButtons', 'SHOW_PLUGIN_DOWNGRADE_BUTTONS', asBoolean, false)
  overrideOrDefault('showPluginDebugInfo', 'SHOW_PLUGIN_DEBUG_INFO', asBoolean, false)
  overrideOrDefault('turnOffFunctionCaching', 'TURN_OFF_FUNCTION_CACHING', asBoolean, false)
  overrideOrDefault('hostingEnabled', 'NPI_HOSTING_ENABLED', asBoolean, false)

  config.nowPrototypeItAPIBaseUrl = process.env.NPI_API_BASE_URL ?? 'https://api.nowprototype.it'

  config.passwords = (config.passwordKeys.split(','))
    .map(passwordKey => passwordKey.trim())
    .filter(passwordKey => validEnvironmentVariableRegex.test(passwordKey) && !!process.env[passwordKey])
    .map(passwordKey => process.env[passwordKey])

  if (process.env.PASSWORD) {
    config.passwords.push(process.env.PASSWORD)
  }

  config.passwordMissing = config.passwords.length < 1 && config.useAuth && config.isProduction

  config.showJsonErrors = config.isDevelopment

  config.getPluginSpecificConfig = (pluginName) => (config['plugin-specific'] || {})[pluginName] || {}

  endPerformanceTimer('config lookup', timer)

  return config
}

module.exports = {
  getConfig,
  external: {
    getPluginSpecificConfig: (...args) => {
      return getConfig().getPluginSpecificConfig(...args)
    }
  }
}
endPerformanceTimer('config setup', performanceTimer)
