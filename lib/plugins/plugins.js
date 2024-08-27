/**
 *
 *  This file returns helper methods to enable services to include
 *  their own departmental frontend(Styles, Scripts, nunjucks etc)
 *
 * Plugins are packages in the `node_modules` folder that contain a
 * `govuk-prototype-kit.config.json` manifest file. By adding paths within the
 * package to the manifest, plugins can expose additional files to the kit.
 * The kit code retrieves the paths as and when needed; this module just
 * contains the code to find and list paths defined by plugins.
 *
 * A schema for an example manifest file follows:
 *
 *     // govuk-prototype-kit.config.json
 *     {
 *       "assets": string | string[],
 *       "importNunjucksMacrosInto": string | string[],
 *       "meta": {
 *         "description": string,
 *         "urls": {
 *           "documentation": string,
 *           "versionHistory": string,
 *           "releaseNotes": string
 *         }
 *       },
 *       "nunjucksMacros": {"importFrom": string, "macroName": string} | {"importFrom": string, "macroName": string}[],
 *       "nunjucksPaths": string | string[],
 *       "nunjucksFilters": string | string[],
 *       "nunjucksFunctions": string | string[],
 *       "pluginDependencies": [{"packageName": string, "minVersion": string, "maxVersion": string}],
 *       "sass": string | string[],
 *       "scripts": string | string[] | {"path": string, "type": string} | {"path": string, "type": string}[],
 *       "stylesheets": string | string[],
 *       "templates": {
 *         "name": string,
 *         "path": string,
 *         "type": string
 *       }[]
 *     }
 *
 * Note that all the top-level keys are optional.
 *
 */

// core dependencies
const fs = require('fs')
const path = require('path')

// local dependencies
const appConfig = require('../config')
const { projectDir } = require('../utils/paths')
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')
const events = require('../dev-server/dev-server-events')
const eventTypes = require('../dev-server/dev-server-event-types')
const { flattenArray, flattenArrayOfObjects } = require('../utils/arrayTools')

const proxyPluginConfig = {}

const npiConfigFile = 'now-prototype-it.config.json'
const gpkConfigFile = 'govuk-prototype-kit.config.json'
const onlyAcceptableVersion = 'version-2024-03'

const pkgPath = path.join(projectDir, 'package.json')
const filterOutParentAndEmpty = part => part && part !== '..'
const objectMap = (object, mapFn) => Object.keys(object).reduce((result, key) => {
  result[key] = mapFn(object[key], key)
  return result
}, {})

// File utilities
const getPathFromProjectRoot = (...all) => path.join(...[projectDir].concat(all))

function readPluginFile (fileToLoad) {
  const jsonContents = readJsonFile(fileToLoad)
  const isGpkConfig = fileToLoad.endsWith(gpkConfigFile)
  if (isGpkConfig) {
    return jsonContents
  } else {
    return jsonContents[onlyAcceptableVersion]
  }
}

const getPluginConfigForPackageName = packageName => {
  const fileToLoad = [
    getPathFromProjectRoot('node_modules', packageName, npiConfigFile),
    getPathFromProjectRoot('node_modules', packageName, gpkConfigFile)
  ].find(path => fs.existsSync(path))
  if (fileToLoad) {
    return readPluginFile(fileToLoad)
  } else {
    return null
  }
}

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

function getPluginConfig (packageName) {
  const timer = startPerformanceTimer()
  const pluginConfig = getPluginConfigForPackageName(packageName)
  if (pluginConfig) {
    return pluginConfig
  }
  const proxyPluginConfigForPackage = proxyPluginConfig && proxyPluginConfig[packageName]
  if (proxyPluginConfigForPackage) {
    endPerformanceTimer('getPluginConfig (backup)', timer)
    return proxyPluginConfigForPackage
  }
  endPerformanceTimer('getPluginConfig (empty)', timer)
  return null
}

/**
 * Handle errors to do with plugin paths
 * @param {{ packageName: string, item: string }} subject - For example { packageName: 'govuk-frontend', item: '/all.js' }
 * @throws when path in item is badly formatted
 */
function throwIfBadFilepath (subject) {
  if (('' + subject.item).indexOf('\\') > -1) {
    throw new Error(`Can't use backslashes in plugin paths - "${subject.packageName}" used "${subject.item}".`)
  }
  if (!('' + subject.item).startsWith('/')) {
    throw new Error(`All plugin paths must start with a forward slash - "${subject.packageName}" used "${subject.item}".`)
  }
}

function getPackageNamesInAlphabeticalOrder () {
  const pkg = fs.existsSync(pkgPath) ? readJsonFile(pkgPath) : {}
  const dependencies = pkg.dependencies || {}
  return Object.keys(dependencies).sort()
}

/**
 * This function groups plugins by type in a format which can used by getList
 *
 * @private
 *
 * Plugins provide items such as sass scripts, asset paths etc.
 *
 * @returns Object.<string, *[]> - for example
 *    {
 *     nunjucksPaths: [
 *      { packageName: 'govuk-frontend', item: '/' },
 *      { packageName: 'govuk-frontend', item: '/components'}
 *    ],
 *    scripts: [
 *      { packageName: 'govuk-frontend', item: '/all.js' }
 *    ]
 *    assets: [
 *      { packageName: 'govuk-frontend', item: '/assets' }
 *    ],
 *    sass: [
 *      { packageName: 'govuk-frontend', item: '/all.scss' }
 *    ]}
 *
 */
function getPluginsByType () {
  const timer = startPerformanceTimer()
  let packageNamesInAlphabeticalOrderToProcess = getPackageNamesInAlphabeticalOrder()
  const pluginNamesAndConfigInOrder = []
  function processPluginByName (pluginName) {
    if (!packageNamesInAlphabeticalOrderToProcess.includes(pluginName)) {
      return
    }
    packageNamesInAlphabeticalOrderToProcess = packageNamesInAlphabeticalOrderToProcess.filter(name => name !== pluginName)
    const pluginConfig = getPluginConfig(pluginName)
    if (!pluginConfig) {
      return
    }
    const pluginDependencies = pluginConfig.pluginDependencies || []
    pluginDependencies.forEach(nameOrObject => {
      processPluginByName(nameOrObject.packageName || nameOrObject)
    })
    pluginNamesAndConfigInOrder.push({
      name: pluginName,
      config: pluginConfig
    })
  }
  let remainingBeforeError = 9999
  while (packageNamesInAlphabeticalOrderToProcess.length > 0) {
    if (--remainingBeforeError < 1) {
      throw new Error('Infinite loop detected in getPluginsByType')
    }
    processPluginByName(packageNamesInAlphabeticalOrderToProcess[0])
  }
  const result = pluginNamesAndConfigInOrder
    .reduce((accum, packageNameAndConfig) => Object.assign({}, accum, objectMap(
      packageNameAndConfig.config,
      (listOfItemsForType, type) => (accum[type] || [])
        .concat([].concat(listOfItemsForType).map(item => ({
          packageName: packageNameAndConfig.name,
          item
        })))
    )), {})
  endPerformanceTimer('getPluginsByType', timer)
  return result
}

let pluginsByType

function setPluginsByType () {
  try {
    pluginsByType = getPluginsByType()
  } catch (err) {
    console.error(err)
    pluginsByType = {}
  }
}

setPluginsByType()

events.on(eventTypes.PLUGIN_LIST_UPDATED, () => {
  setPluginsByType()
})

function getUriFromParts (urlParts) {
  return urlParts
    .map(encodeURIComponent)
    .join('/')
}

function getContextUrlForPlugin (config) {
  return getUriFromParts(['', 'plugin-assets', config.packageName])
}

const getPublicUrl = config => {
  const uriParts = ['', 'plugin-assets', config.packageName]
    .concat(config.item?.split('/').filter(filterOutParentAndEmpty))
  return getUriFromParts(uriParts)
}

function getFileSystemPath ({ packageName, item }) {
  // item will either be the plugin path or will be an object containing the plugin path within the src property
  item = item.path || item
  throwIfBadFilepath({ packageName, item })
  return getPathFromProjectRoot('node_modules',
    packageName,
    item.split('/').filter(filterOutParentAndEmpty).join(path.sep))
}

function getPublicUrlAndFileSystemPath ({ packageName, item }) {
  // item will either be the plugin path or will be an object containing the plugin path within the src property
  item = item.path || item
  return {
    fileSystemPath: getFileSystemPath({ packageName, item }),
    publicUrl: getPublicUrl({ packageName, item })
  }
}

const getList = type => pluginsByType[type] || []

const knownWordsToFormat = {
  govuk: 'GOV.UK',
  hmrc: 'HMRC',
  moj: 'MOJ',
  hmcts: 'HMCTS',
  dfe: 'DfE',
  ho: 'HO',
  ons: 'ONS',
  jquery: 'jQuery',
  dwp: 'DWP',
  tpr: 'TPR',
  ministryofjustice: 'Ministry of Justice',
  nowprototypeit: 'Now Prototype It',
  nhsuk: 'NHS.UK'
}

function prepareWordForPackageNameDisplay (word) {
  const safeWord = word || ''
  const lowercaseWord = safeWord.toLowerCase()
  const knownWord = knownWordsToFormat[lowercaseWord]
  if (knownWord) {
    return knownWord
  }
  return (safeWord[0] || '').toUpperCase() + safeWord.substring(1).toLowerCase()
}

function prepareName (name) {
  if (name === 'x-govuk') {
    return name
  }
  return name
    .split('-')
    .map(prepareWordForPackageNameDisplay).join(' ')
}

function preparePackageNameForDisplay (packageName) {
  const safePackageName = (packageName || '')

  const packageNameDetails = {}

  if (safePackageName.startsWith('@')) {
    packageNameDetails.name = prepareName(safePackageName.split('/')[1])
    packageNameDetails.scope = prepareName(safePackageName.split('/')[0].split('@')[1])
  } else {
    packageNameDetails.name = prepareName(safePackageName)
  }

  return packageNameDetails
}

const getByType = type => getList(type)
const getByTypeWithPathExpanded = type => getList(type).map(x => {
  if (typeof x.item === 'string') {
    return {
      ...x,
      item: getFileSystemPath(x)
    }
  }
  return {
    ...x,
    item: {
      ...x.item,
      path: getFileSystemPath(x)
    }
  }
})

/**
 * Gets public urls for all plugins of type
 * @param {string} listType - (scripts, stylesheets, nunjucks etc)
 * @return {string[]} A list of urls
 */
const getPublicUrls = listType => getList(listType).map(({ packageName, item }) => {
  // item will either be the plugin path or will be an object containing the plugin path within the src property
  if (listType === 'scripts' && typeof item === 'object') {
    const { path, type } = item
    const publicUrl = getPublicUrl({ packageName, item: path })
    return { src: publicUrl, type }
  } else {
    return getPublicUrl({ packageName, item })
  }
})

/**
 * Gets filesystem paths for all plugins of type
 * @param {string} listType - (scripts, stylesheets, nunjucks etc)
 * @return {string[]} An array of filesystem paths
 */
const getFileSystemPaths = listType => getList(listType).map(getFileSystemPath)

/**
 * Gets filesystem paths for all plugins of type
 * @param {string} listType - (scripts, stylesheets, nunjucks etc)
 * @return {{fileSystemPath: string, packageName: string}[]} An array of filesystem paths
 */
const getPackageNameAndFileSystemPaths = listType => getList(listType).map(x => ({
  fileSystemPath: getFileSystemPath(x),
  packageName: x.packageName
}))

/**
 * Gets public urls and filesystem paths for all plugins of type
 * @param {string} type - (scripts, stylesheets, nunjucks etc)
 * @return {{fileSystemPath: string, publicUrl: string}[]} An array of urls and filesystem paths
 */
const getPublicUrlAndFileSystemPaths = type => getList(type).map(getPublicUrlAndFileSystemPath)

/**
 * This is used in the views to output links and scripts for each file
 * @param {{scripts: string[], stylesheets: string[]}} additionalConfig
 * @return {{scripts: {src: string, type: string}[], stylesheets: string[]}} Returns an object containing two keys(scripts & stylesheets),
 *   each item contains an array of full paths to specific files.
 */
function getAppConfig (additionalConfig) {
  return {
    scripts: self.getPublicUrls('scripts').concat((additionalConfig || {}).scripts || []).map((item) => typeof item === 'string' ? { src: item } : item),
    stylesheets: self.getPublicUrls('stylesheets').concat((additionalConfig || {}).stylesheets || [])
  }
}

/**
 * This is used to configure nunjucks in server.js
 * @param {string[]} additionalViews
 * @return {string[]} Returns an array of paths to nunjucks templates
 */
const getAppViews = additionalViews => self.getFileSystemPaths('nunjucksPaths')
  .reverse()
  .concat(additionalViews || [])

function prepareVariableValue (fieldSettings, packageName) {
  const pluginSpecificUserConfig = appConfig.getConfig().getPluginSpecificConfig(packageName)
  const theKey = fieldSettings?.userInterface?.key
  if (theKey && pluginSpecificUserConfig && pluginSpecificUserConfig[theKey] !== undefined) {
    return pluginSpecificUserConfig[theKey]
  }
  if (typeof fieldSettings.value === 'string') {
    return fieldSettings.value
      .replaceAll('{{PLUGIN_ASSETS_URL_CONTEXT}}', getContextUrlForPlugin({ packageName }))
      .replaceAll('{{ALL_PLUGINS_ASSETS_URL_CONTEXT}}', '/plugin-assets')
      .replaceAll('{{SCRIPTS_NJK_INCLUDE}}', 'prototype-core/includes/scripts.html')
      .replaceAll('{{STYLES_NJK_INCLUDE}}', 'prototype-core/includes/stylesheets.html')
      .replaceAll('{{PLUGIN_SPECIFIC_SETTINGS_PAGE_URL}}', `/manage-prototype/settings/plugin-specific/${encodeURIComponent(packageName)}`)
  }
  return fieldSettings.value
}

function getVariablesByType (variableType) {
  return getList('settings').map(({ packageName, item }) => {
    const value = item?.value
    const varName = item?.variableNames && item.variableNames[variableType]
    if (value !== undefined && varName !== undefined) {
      return {
        key: varName,
        value: prepareVariableValue(item, packageName),
        isDefault: !!item?.isDefault
      }
    }
    return undefined
  }).filter(x => x !== undefined)
}

function getSettingsForUI () {
  const variableType = 'settings'
  return getList(variableType).map(({ packageName, item }) => {
    if (item.userInterface) {
      return {
        packageName,
        item
      }
    }
    return undefined
  }).filter(x => x !== undefined)
}

const getNunjucksVariables = () => getVariablesByType('nunjucks')
const getAppLocalModifiers = () => getFileSystemPaths('appLocalModifiers')
const getSassVariables = () => getVariablesByType('sass')
const getRelatedPlugins = () => getList('relatedPlugins')
const getKnownPlugins = () => {
  const relatedPluginConfigs = getRelatedPlugins()
  return flattenArray(relatedPluginConfigs.map(x => x.item?.fromNpm))
}
const getProxyPluginConfig = () => {
  const relatedPluginConfigs = getRelatedPlugins()
  return flattenArrayOfObjects(relatedPluginConfigs.map(x => x.item?.proxyPluginConfig))
}

// Exports
const self = module.exports = {
  preparePackageNameForDisplay,
  getByType,
  getByTypeWithPathExpanded,
  getPublicUrls,
  getFileSystemPaths,
  getPublicUrlAndFileSystemPaths,
  getAppConfig,
  getAppViews,
  getNunjucksVariables,
  getAppLocalModifiers,
  getSassVariables,
  setPluginsByType,
  getRelatedPlugins,
  getKnownPlugins,
  getPackageNameAndFileSystemPaths,
  getProxyPluginConfig,
  getSettingsForUI
}
