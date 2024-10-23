const { getManagementView, contextPath, getPageNavLinks } = require('../../utils')
const bodyParser = require('body-parser')
const { readJSON, writeJSON } = require('fs-extra')
const path = require('path')
const { projectDir } = require('../../../../utils/paths')
const defaultValue = '__default__'

const events = require('../../../dev-server-events')
const eventTypes = require('../../../dev-server-event-types')
const { getSettingsForUI, preparePackageNameForDisplay } = require('../../../../plugins/plugins')

const bpMiddleware = bodyParser.urlencoded({ extended: true })

function getSideNavLinks (path) {
  const coreSettingsPages = [
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
  ]
  const pluginSpecificPages = getSettingsForUI()
    .map(({ packageName }) => packageName)
    .reduce((acc, packageName) => {
      if (acc.includes(packageName)) {
        return acc
      }
      return [...acc, packageName]
    }, [])
    .map(packageName => {
      const packageNameForDisplay = preparePackageNameForDisplay(packageName)
      return {
        text: packageNameForDisplay.name,
        subtext: packageNameForDisplay.scope ? 'By ' + packageNameForDisplay.scope : undefined,
        url: '/settings/plugin-specific/' + encodeURIComponent(packageName)
      }
    })
  const divider = pluginSpecificPages.length > 0 ? [{ isDivider: true, headerText: 'Plugin-specific settings:' }] : []
  return [...coreSettingsPages, ...divider, ...pluginSpecificPages].map(original => ({
    ...original,
    url: `${contextPath}${original.url}`,
    isCurrentPage: path === original.url
  }))
}

async function getConfig () {
  try {
    return await readJSON(path.join(projectDir, 'app', 'config.json'))
  } catch (e) {
    return {}
  }
}

async function writeConfig (config) {
  await writeJSON(path.join(projectDir, 'app', 'config.json'), config, { encoding: 'utf8', spaces: 2 })
  events.emitExternal(eventTypes.TRIGGER_KIT_REBUILD_AND_RESTART)
}

function prepareFieldValue (config, field) {
  let container = config
  const context = [...(field.context || [])]
  while (context.length > 0) {
    const nextContext = context.shift()
    container = container[nextContext] || {}
  }
  const rawValue = container[field.key]
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

async function saveConfigUpdates (req, fields) {
  let toastQueryString = `toast=saved-settings&toastTime=${new Date().getTime()}`
  const configObj = await getConfig()
  const getContext = (context) => {
    let container = configObj
    const ctx = [...(context || [])]
    while (ctx.length > 0) {
      const nextContext = ctx.shift()
      if (!container[nextContext]) {
        container[nextContext] = {}
      }
      container = container[nextContext]
    }
    return container
  }
  const setValue = (key, value, context) => {
    getContext(context)[key] = value
  }
  const useDefault = (key, context) => {
    delete getContext(context)[key]
  }

  function hasChanged (fieldConfig, key, value, context) {
    return fieldConfig.key === key && '' + getContext(context)[key] !== value && !(getContext(context)[key] === undefined && value === '')
  }

  Object.keys(req.body)
    .forEach(key => {
      const value = req.body[key]
      const fieldConfig = fields.find(field => field.key === key)
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
          setValue(key, true, fieldConfig.context)
          return
        }
        if (value === 'false') {
          setValue(key, false, fieldConfig.context)
          return
        }
        if (value === defaultValue) {
          useDefault(key, fieldConfig.context)
          return
        }
      }
      if (fieldConfig.type === 'int') {
        if (value === '') {
          useDefault(key, fieldConfig.context)
          return
        }
        setValue(key, parseInt(value, 10), fieldConfig.context)
        return
      }
      if (fieldConfig.type === 'text') {
        if (value === '') {
          useDefault(key, fieldConfig.context)
          return
        }
        setValue(key, '' + value, fieldConfig.context)
        return
      }
      console.log(`Field type [${fieldConfig.type}] not known for key [${key}] and value [${value}]`)
    })
  Object.keys(configObj['plugin-specific'] || {}).forEach(packageName => {
    if (Object.keys(configObj['plugin-specific'][packageName]).length === 0) {
      delete configObj['plugin-specific'][packageName]
    }
  })
  if (Object.keys(configObj['plugin-specific'] || {}).length === 0) {
    delete configObj['plugin-specific']
  }
  await writeConfig(configObj)
  return toastQueryString
}

function setupUrlToHandleFields (router, url, fields) {
  router.get(url, async (req, res) => {
    const model = await getModel(req, fields)
    res.render(getSettingsView(), model)
  })
  router.post(url, [bpMiddleware], async (req, res) => {
    const toastQueryString = await saveConfigUpdates(req, fields)
    res.redirect(req.originalUrl.split('?')[0] + '?' + toastQueryString)
  })
}

const setupSettingsRoutes = (router) => {
  setupUrlToHandleFields(router, '/settings', [
    {
      key: 'useAutoStoreData',
      type: 'bool',
      name: 'Use "auto store data"',
      description: 'This will capture the user\'s input and store it to their session when they submit a form or when a parameter is in the query string.'
    },
    {
      key: 'showPrereleases',
      type: 'bool',
      name: 'Show plugin prereleases',
      description: 'In the plugins page we show the latest releases, some plugins make pre-releases to allow testing before the official release.  This option lets you choose whether or not you see those pre-releases.'
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
      key: 'respectFileExtensions',
      type: 'bool',
      name: 'Respect file extensions and allow markdown files',
      stage: 1,
      description: 'Allows you to use .html for HTML files without nunjucks processing, allows you to use .md for Markdown files. Extremely experimental, implementation is very likely to change.'
    },
    {
      key: 'hostingEnabled',
      type: 'bool',
      name: 'Show the hosting tab in Manage Prototype',
      stage: 1,
      description: 'We will be adding the hosting tab for everyone but at the time of writing we\'re testing it with the first round of users.'
    },
    {
      key: 'editInBrowser',
      type: 'bool',
      name: 'Edit your prototype in the browser',
      stage: 1,
      description: 'Allows you to edit your prototype in the browser as well as your code editor.  We use an in-browser version of VS Code for this.'
    }
  ])
  const settingsByPlugin = {}
  getSettingsForUI().forEach(({ packageName, item }) => {
    if (!settingsByPlugin[packageName]) {
      settingsByPlugin[packageName] = []
    }
    if (!item?.userInterface?.key) {
      console.error('The plugin', packageName, 'has a setting without a key', item)
      return
    }
    settingsByPlugin[packageName].push({
      context: ['plugin-specific', packageName],
      key: (item.userInterface.key).replaceAll(/[^a-zA-Z0-9]/g, '-'),
      type: item.userInterface.type === 'string' ? 'text' : item.userInterface.type,
      name: item.userInterface.name,
      description: item.userInterface.hintText
    })
  })
  Object.keys(settingsByPlugin).forEach(packageName => {
    setupUrlToHandleFields(router, `/settings/plugin-specific/${encodeURIComponent(packageName)}`, settingsByPlugin[packageName])
  })
  router.get('/settings/plugin-specific/:pluginName', async (req, res) => {
    res.render(getSettingsView(), {
      ...await getModel(req),
      errorHeading: 'No settings available for this plugin.',
      errorText: 'This can happen if you\'ve recently uninstalled the plugin or if they\'ve updated their configuration.'
    })
  })
}

module.exports = {
  setupSettingsRoutes
}
