const { getManagementView, contextPath, getPageNavLinks } = require('../../utils')
const { readJSON, writeJSON } = require('fs-extra')
const path = require('path')
const { projectDir } = require('../../../../utils/paths')
const defaultValue = '__default__'

const events = require('../../../dev-server-events')
const eventTypes = require('../../../dev-server-event-types')

function getSideNavLinks (path) {
  return [
    {
      text: 'Basic settings',
      url: '/settings'
    },
    {
      text: 'Advanced settings',
      url: '/settings/advanced'
    },
    {
      text: 'Experiments',
      url: '/settings/experiments'
    }
  ].map(original => ({
    ...original,
    url: `${contextPath}${original.url}`,
    isCurrentPage: path === original.url
  }))
}

async function getConfig () {
  return await readJSON(path.join(projectDir, 'app', 'config.json'))
}

async function writeConfig (config) {
  return await writeJSON(path.join(projectDir, 'app', 'config.json'), config, { encoding: 'utf8', spaces: 2 })
}

function prepareFieldValue (config, field) {
  const rawValue = config[field.key]
  if (field.type === 'bool') {
    if (rawValue === undefined) {
      return defaultValue
    }
    return '' + rawValue
  }
  return rawValue
}

async function getModel (req, fields) {
  const currentTime = new Date().getTime()
  const toastStillRelevant = parseInt(req.query.toastTime, 10) > currentTime - 1000 * 20
  return {
    headerSubNavItems: getPageNavLinks(req),
    currentSection: 'Settings',
    currentUrl: req.originalUrl,
    sideNavLinks: getSideNavLinks(req.path),
    defaultValue,
    fields: await getConfig().then(config => (fields || []).map(field => ({
      ...field,
      value: prepareFieldValue(config, field)
    }))),
    toast: toastStillRelevant && req.query.toast,
    changedPort: toastStillRelevant && req.query.changedPort === 'true'
  }
}

function getSettingsView () {
  return getManagementView('settings/settings.njk')
}

async function saveConfigUpdates (req, basicSettingFields) {
  let toastQueryString = `toast=saved-settings&toastTime=${new Date().getTime()}`
  const configObj = await getConfig()
  const setValue = (key, value) => {
    configObj[key] = value
  }
  const useDefault = (key) => {
    delete configObj[key]
  }

  function hasChanged (fieldConfig, key, value) {
    return fieldConfig.key === key && '' + configObj[key] !== value && !(configObj[key] === undefined && value === '')
  }

  Object.keys(req.body)
    .forEach(key => {
      const value = req.body[key]
      const fieldConfig = basicSettingFields.find(field => field.key === key)
      if (!fieldConfig) {
        console.log(`Manage prototype settings: Unexpected key [${key}] with value [${value}`)
        return
      }
      if (hasChanged(fieldConfig, 'port', value)) {
        toastQueryString += '&changedPort=true'
      }
      if (hasChanged(fieldConfig, 'serviceName', value)) {
        events.emitExternal(eventTypes.KIT_RESTART)
      }
      if (fieldConfig.type === 'bool') {
        if (value === 'true') {
          setValue(key, true)
          return
        }
        if (value === 'false') {
          setValue(key, false)
          return
        }
        if (value === defaultValue) {
          useDefault(key)
          return
        }
      }
      if (fieldConfig.type === 'int') {
        if (value === '') {
          useDefault(key)
          return
        }
        setValue(key, parseInt(value, 10))
        return
      }
      if (fieldConfig.type === 'text') {
        if (value === '') {
          useDefault(key)
          return
        }
        setValue(key, '' + value)
        return
      }
      console.log(`Field type [${fieldConfig.type}] not known for key [${key}] and value [${value}]`)
    })
  await writeConfig(configObj)
  return toastQueryString
}

function setupUrlToHandleFields (router, url, fields) {
  router.get(url, async (req, res) => {
    const model = await getModel(req, fields)
    res.render(getSettingsView(), model)
  })
  router.post(url, async (req, res) => {
    const toastQueryString = await saveConfigUpdates(req, fields)
    res.redirect(req.originalUrl.split('?')[0] + '?' + toastQueryString)
  })
}

const setupSettingsRoutes = (router) => {
  setupUrlToHandleFields(router, '/settings', [
    {
      key: 'serviceName',
      type: 'text',
      name: 'Service Name',
      description: 'This will appear in your header if you\'re using GOV.UK Frontend'
    },
    {
      key: 'useAutoStoreData',
      type: 'bool',
      name: 'Use "auto store data"',
      description: 'This will capture the user\'s input and store it to their session when they submit a form or when a parameter is in the query string.'
    },
    {
      key: 'useNjkExtensions',
      type: 'bool',
      name: 'Use .njk extensions',
      description: 'The GOV.UK Prototype Kit defaulted to using .html for all nunjucks files, we find it\'s more helpful to use .njk extension.  This will only affect new files that are created, whatever you set this to you can load a mix of .html and .njk without problems.'
    },
    {
      key: 'showPrereleases',
      type: 'bool',
      name: 'Show plugin prereleases',
      description: 'In the plugins page we show the latest releases, some plugins make pre-releases to allow testing before the official release.  This option lets you choose whether or not you see those pre-releases.'
    },
    {
      key: 'allowGovukFrontendUninstall',
      type: 'bool',
      name: 'Allow GOV.UK Frontend to be uninstalled'
    },
    {
      key: 'autoReloadPages',
      type: 'bool',
      name: 'Auto reload pages',
      description: 'Pages will automatically refresh when you make changes to a file'
    }
  ])
  setupUrlToHandleFields(router, '/settings/advanced', [
    {
      key: 'port',
      type: 'int',
      name: 'Network port',
      description: 'The port that the kit runs on, it defaults to 3000 in which case you\'ll access your kit via http://localhost:3000/'
    },
    {
      key: 'useAuth',
      type: 'bool',
      name: 'Use authentication',
      description: 'Password protect this prototype when it\'s hosted, we recommend this is always on (or default).'
    },
    {
      key: 'useHttps',
      type: 'bool',
      name: 'Use HTTPS',
      description: 'On hosted environments HTTPS is important for the safety of information being passed from the user\'s browser to the prototype.'
    },
    {
      key: 'logPerformance',
      type: 'bool',
      name: 'Log performance',
      description: 'This will log the time it takes for your system to run the internals of the prototype kit.'
    },
    {
      key: 'logPerformanceMatching',
      type: 'text',
      name: 'Log performance, matching',
      description: 'This restricts the performance logs (if they\'re set up) to only show if it contains one of these comma seperated values.'
    },
    {
      key: 'logPerformanceSummary',
      type: 'int',
      name: 'Log performance summary',
      description: 'This will log a performance summary on a schedule, if you want this then enter the number of milliseconds you want between performance reports (e.g. 5000 for five seconds).'
    },
    {
      key: 'verbose',
      type: 'bool',
      name: 'Verbose logging',
      description: 'This will show much more detailed logs while the kit is running'
    },
    {
      key: 'passwordKeys',
      type: 'bool',
      name: 'Password Keys',
      description: 'A comma seperated list of environment variables to treat the same as PASSWORD - this allows you to set multiple passwords in multiple environment variables.'
    }
  ])
  setupUrlToHandleFields(router, '/settings/experiments', [
    {
      key: 'showPluginLookup',
      type: 'bool',
      name: 'Show plugin lookup',
      description: 'Allows you to find plugins which aren\'t in the available plugins list on the plugins page.'
    }
  ])
}

module.exports = {
  setupSettingsRoutes
}
