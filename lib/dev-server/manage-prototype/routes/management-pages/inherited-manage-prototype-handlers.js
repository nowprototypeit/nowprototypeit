// core dependencies
const path = require('path')

// npm dependencies
const fse = require('fs-extra')
const querystring = require('querystring')
const { doubleCsrf } = require('csrf-csrf')

// local dependencies
const config = require('../../../../config')
const plugins = require('../../../../plugins/plugins')
const { packageDir, appViewsDir } = require('../../../../utils/paths')

const {
  version: currentKitVersion
} = require(path.join(packageDir, 'package.json'))
const pluginDetails = require('../../../../utils/packageDetails')
const {
  getPluginDetailsFromFileSystem,
  getPluginDetailsFromGithub,
  getPluginDetailsFromNpm,
  getLatestPluginDetailsFromNpm,
  getPluginDetailsFromRef,
  getInstalledPackages,
  getKnownPlugins,
  getInstalledPluginDetails,
  isInstalled
} = pluginDetails
const { getConfig } = require('../../../../config')

const {
  contextPath,
  getManagementView,
  getPageNavLinks,
  getNavLinks
} = require('../../utils')
const { requestTemplatePreviewFromKit, locateTemplateConfig } = require('./templates')
const { queueCommand } = require('./plugins')

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: (req) => 'Secret',
  cookieName: 'x-csrf-token'
})

const csrfErrorHandler = (error, req, res, next) => {
  if (error === invalidCsrfTokenError) {
    res.status(403).json({
      error: 'invalid csrf token'
    })
  } else {
    next()
  }
}

function getCsrfTokenHandler (req, res) {
  const token = generateToken(res, req)
  return res.json({ token })
}

function exampleTemplateConfig (packageName, { name, path }) {
  const queryString = `?package=${encodeURIComponent(packageName)}&template=${encodeURIComponent(path)}`
  return {
    name,
    path: require('path').join(packageName, path),
    installLink: `/manage-prototype/templates/install${queryString}`,
    viewLink: `/manage-prototype/templates/view${queryString}`
  }
}

function getPluginTemplates () {
  const templates = plugins.getByType('templates')
  const output = []
  templates.forEach(({ packageName, item }) => {
    const matchingPackages = output.filter(x => x.packageName === packageName)
    if (item.type !== 'nunjucks') {
      console.warn(`Omitting ${item.name} from ${packageName} because the type ${JSON.stringify(item.type)} isn't supported.  The only currently supported type is "nunjucks".`)
      return
    }
    let packageDescription
    if (matchingPackages.length > 0) {
      packageDescription = matchingPackages[0]
    } else {
      packageDescription = {
        packageName,
        pluginDisplayName: plugins.preparePackageNameForDisplay(packageName),
        templates: []
      }
      output.push(packageDescription)
    }
    packageDescription.templates.push(exampleTemplateConfig(packageName, item))
  })
  return output
}

async function getTemplatesHandler (req, res) {
  const pageName = 'Templates'
  const availableTemplates = getPluginTemplates()

  const commonTemplatesPackageName = '@govuk-prototype-kit/common-templates'
  const govukFrontendPackageName = 'govuk-frontend'
  let commonTemplatesDetails
  const installedPlugins = (await pluginDetails.getInstalledPackages()).map((pkg) => pkg.packageName)
  if (installedPlugins.includes(govukFrontendPackageName) && !installedPlugins.includes(commonTemplatesPackageName)) {
    const plugin = await getLatestPluginDetailsFromNpm(commonTemplatesPackageName)
    commonTemplatesDetails = {
      pluginDisplayName: plugin?.name,
      installLink: plugin?.links?.install
    }
  }

  res.render('templates/list.njk', {
    ...req.app.locals,
    currentSection: pageName,
    headerSubNavItems: getPageNavLinks(req),
    availableTemplates,
    commonTemplatesDetails
  })
}

async function getTemplatesViewHandler (req, res, next) {
  try {
    res.send((await requestTemplatePreviewFromKit(req.query)).html)
  } catch (e) {
    console.error(e)
    next(e)
  }
}

function getTemplatesInstallHandler (req, res) {
  const templateConfig = locateTemplateConfig(req.query)

  if (templateConfig) {
    res.render('templates/install.njk', {
      ...req.app.locals,
      currentSection: 'Templates',
      pageName: `Create new ${templateConfig.name || 'page from template'}`,
      currentUrl: req.originalUrl,
      headerSubNavItems: getPageNavLinks(req),
      templateName: templateConfig.name,
      error: ({
        exists: 'Path already exists',
        missing: 'Enter a path',
        singleSlash: 'Path must not be a single forward slash (/)',
        endsWithSlash: 'Path must not end in a forward slash (/)',
        multipleSlashes: 'must not include a slash followed by another slash (//)',
        invalid: 'Path must not include !$&\'()*+,;=:?#[]@.% or space'
      })[req.query.errorType],
      chosenUrl: req.query['chosen-url']
    })
  } else {
    res.status(404).send('Template not found.')
  }
}

function getFileExtensionForNunjucksFiles () {
  return config.getConfig().useNjkExtensions ? 'njk' : 'html'
}

async function postTemplatesInstallHandler (req, res) {
  const templateDetails = locateTemplateConfig(req.query)

  let chosenUrl = req.body['chosen-url'].trim().normalize()

  const installLocation = path.join(appViewsDir, `${chosenUrl}.${(getFileExtensionForNunjucksFiles())}`)

  const renderError = (errorType) => {
    const query = querystring.stringify({
      ...req.query,
      'chosen-url': req.body['chosen-url'],
      errorType
    })
    const url = `${req.originalUrl.split('?')[0]}?${query}`
    res.redirect(url)
  }

  if (!chosenUrl.length) {
    renderError('missing')
    return
  }

  if (chosenUrl === '/') {
    renderError('singleSlash')
    return
  }

  if (chosenUrl[chosenUrl.length - 1] === '/') {
    renderError('endsWithSlash')
    return
  }

  if (chosenUrl.indexOf('//') !== -1) {
    renderError('multipleSlashes')
    return
  }

  // Don't allow URI reserved characters (per RFC 3986) in paths
  if ('!$&\'()*+,;=:?#[]@.% '.split('').some((char) => chosenUrl.includes(char))) {
    renderError('invalid')
    return
  }

  if (await fse.exists(installLocation)) {
    renderError('exists')
    return
  }

  await fse.ensureDir(path.dirname(installLocation))
  await fse.copy(templateDetails.path, installLocation)

  // Inject a forward slash if the user hasn't included one
  if (chosenUrl[0] !== '/') {
    chosenUrl = '/' + chosenUrl
  }

  res.redirect(`/manage-prototype/templates/post-install?chosen-url=${encodeURIComponent(chosenUrl)}`)
}

function getTemplatesPostInstallHandler (req, res) {
  const pageName = 'Page created'
  const chosenUrl = req.query['chosen-url']

  res.render('templates/post-install.njk', {
    ...req.app.locals,
    currentSection: 'Templates',
    pageName,
    headerSubNavItems: getPageNavLinks(req),
    url: chosenUrl,
    filePath: path.join('app', 'views', `${chosenUrl}.${getFileExtensionForNunjucksFiles()}`)
  })
}

async function buildPluginData (plugin) {
  const latestVersion = (await getLatestPluginDetailsFromNpm(plugin.packageName))?.version
  const installedPlugin = await getInstalledPluginDetails(plugin.packageName)
  const installedVersion = installedPlugin?.version

  return {
    ...plugin,
    installedVersion,
    isInstalled: !!installedVersion,
    updateAvailable: latestVersion && installedVersion && installedVersion !== latestVersion,
    description: plugin.pluginConfig?.meta?.description,
    pluginDetailsLink: installedPlugin?.links?.pluginDetails || plugin?.links?.pluginDetails
  }
}

function getTimeSummary (date) {
  const epochDate = date.getTime()
  const epochNow = new Date().getTime()
  const timeDifferenceInDays = (epochNow - epochDate) / 1000 / 60 / 60 / 24
  if (timeDifferenceInDays < 1) {
    return 'today'
  }
  if (timeDifferenceInDays < 2) {
    return 'yesterday'
  }
  if (timeDifferenceInDays < 14) {
    return Math.floor(timeDifferenceInDays) + ' days ago'
  }
  return Math.floor(timeDifferenceInDays / 7) + ' weeks ago'
}

async function prepareForPluginPage (isInstalledPage, search) {
  const [allPlugins, installedPlugins] = await Promise.all([getKnownPlugins(), getInstalledPackages()])

  const plugins = (isInstalledPage
    ? installedPlugins
    : allPlugins.filter(plugin => {
      const { packageName } = plugin || {}
      const pluginName = packageName?.toLowerCase()
      if (!pluginName) {
        return false
      }
      return pluginName.indexOf(search.toLowerCase()) >= 0
    })).filter(({ error }) => !error)

  installedPlugins.forEach(plugin => {
    if (!plugins.find(({ packageName }) => packageName === plugin.packageName)) {
      plugins.push(plugin)
    }
  })

  const pluginList = await Promise.all(plugins.map(buildPluginData))

  pluginList.sort((l, r) => {
    if (l.updateAvailable && !r.updateAvailable) {
      return -1
    }
    if (r.updateAvailable && !l.updateAvailable) {
      return 1
    }
    if (l.isInstalled && !r.isInstalled) {
      return -1
    }
    if (r.isInstalled && !l.isInstalled) {
      return 1
    }
    return 0
  })

  return {
    status: isInstalledPage ? 'installed' : 'search',
    plugins: pluginList,
    found: pluginList.length,
    updates: pluginList.filter(({ updateAvailable }) => updateAvailable).length
  }
}

const verbs = {
  update: {
    title: 'Update',
    para: 'update',
    status: 'updated',
    progressive: 'updating',
    progressiveTitle: 'Updating',
    dependencyPara: 'install'
  },
  install: {
    title: 'Install',
    para: 'install',
    status: 'installed',
    progressive: 'installing',
    progressiveTitle: 'Installing',
    dependencyPara: 'install'
  },
  uninstall: {
    title: 'Uninstall',
    para: 'uninstall',
    status: 'uninstalled',
    progressive: 'uninstalling',
    progressiveTitle: 'Uninstalling',
    dependencyPara: 'uninstall'
  }
}

function getInstalledPluginsSubtext (numberOfUpdates = 0) {
  if (numberOfUpdates === 0) {
    return undefined
  }
  if (numberOfUpdates === 1) {
    return '1 update available'
  }
  return numberOfUpdates + ' updates available'
}

function getPluginSideNav (req, numberOfUpdates = 0) {
  const sideNavLinksBeforeCurrentPageAdded = [
    {
      text: 'Installed plugins',
      url: contextPath + '/plugins/installed',
      subtext: getInstalledPluginsSubtext(numberOfUpdates)
    },
    {
      text: 'Discover plugins',
      url: contextPath + '/plugins/discover'
    }
  ]
  if (getConfig().showPluginLookup) {
    sideNavLinksBeforeCurrentPageAdded.push({
      url: contextPath + '/plugins/lookup',
      text: 'Lookup a specific plugin'
    })
  }
  const sideNavLinks = getNavLinks(req, sideNavLinksBeforeCurrentPageAdded, 3)
  return sideNavLinks
}

async function getPluginLookupHandler (req, res) {
  const { updates } = await prepareForPluginPage(false, '')
  return res.render(getManagementView('plugins/lookup.njk'), {
    ...req.app.locals,
    headerSubNavItems: getPageNavLinks(req),
    sideNavLinks: getPluginSideNav(req, updates)
  })
}

async function getPluginsHandler (req, res) {
  const isInstalledPage = req.route.path.endsWith('installed')
  const {
    search = '',
    error,
    fsPath,
    githubOrg,
    githubProject,
    githubBranch,
    npmPackage,
    npmVersion,
    source
  } = req.query || {}
  const { plugins, status, updates = 0, found = 0 } = await prepareForPluginPage(isInstalledPage, search)
  const foundWord = isInstalledPage ? 'installed' : 'found'
  const foundMessage = found === 1 ? found + ' Plugin found' : found + ' Plugins ' + foundWord
  const updatesMessage = updates ? updates === 1 ? updates + ' UPDATE AVAILABLE' : updates + ' UPDATES AVAILABLE' : ''
  const sideNavLinks = getPluginSideNav(req, updates)

  const model = {
    ...req.app.locals,
    headerSubNavItems: getPageNavLinks(req),
    isInstalledPage,
    isSearchPage: !isInstalledPage,
    sideNavLinks,
    search,
    plugins,
    updatesMessage,
    foundMessage,
    status,
    playback: {
      error,
      fsPath,
      githubOrg,
      githubProject,
      githubBranch,
      npmPackage,
      npmVersion,
      source
    }
  }

  res.render(getManagementView('plugins/list.njk'), model)
}

async function postPluginsHandler (req, res) {
  const query = req.body?.search?.trim() ? `?search=${req.body.search}` : ''
  const url = contextPath + req.route.path + query
  res.redirect(url)
}

async function postPluginDetailsHandler (req, res) {
  let found
  const {
    fsPath,
    githubOrg,
    githubProject,
    githubBranch,
    npmPackage,
    npmVersion,
    source,
    notFoundErrorUrl
  } = req.body

  if (source === 'fs') {
    found = await getPluginDetailsFromFileSystem(fsPath)
  } else if (source === 'github') {
    found = await getPluginDetailsFromGithub(githubOrg, githubProject, githubBranch)
  } else if (source === 'npm' && npmVersion) {
    found = await getPluginDetailsFromNpm(npmPackage, npmVersion)
  } else if (source === 'npm') {
    found = await getLatestPluginDetailsFromNpm(npmPackage)
  }

  if (found && found.exists && found.pluginConfig) {
    res.redirect(found.links.pluginDetails)
  } else {
    const [url, query] = notFoundErrorUrl.split('?')
    const queryParts = [query].concat([
      'fsPath',
      'githubOrg',
      'githubProject',
      'githubBranch',
      'npmPackage',
      'npmVersion',
      'source'
    ].map(x => {
      return x && `${encodeURIComponent(x)}=${encodeURIComponent(req.body[x])}`
    })).filter(x => x)
    res.redirect([url, queryParts.join('&')].join('?'))
  }
}

async function getPluginDetailsHandler (req, res, next) {
  const config = getConfig()
  const plugin = await getPluginDetailsFromRef(req.params.packageRef).catch(e => undefined)

  if (!plugin?.pluginConfig) {
    console.warn('No page found for plugin ref', req.params.packageRef)
    const err = new Error('Plugin not found - no plugin config')
    err.status = 404
    next(err)
    return
  }

  if (req.originalUrl !== plugin.links.pluginDetails) {
    const redirectUrl = plugin.links.pluginDetails
    res.redirect(redirectUrl)
    return
  }

  const latestVersionPromise = plugin.origin === 'NPM' ? getLatestPluginDetailsFromNpm(plugin.packageName) : Promise.resolve(undefined)
  const installedVersionPromise = getInstalledPluginDetails(plugin.packageName)

  function replaceUrlVars (url) {
    return url && url
      .replace('{{version}}', plugin.version || plugin.latestVersion)
      .replace('{{kitVersion}}', currentKitVersion)
  }

  function getInThisPluginDetails () {
    const list = []
    if (plugin.pluginConfig.nunjucksMacros && plugin.pluginConfig.nunjucksMacros.length > 0) {
      list.push({
        title: 'Components',
        items: plugin.pluginConfig.nunjucksMacros.map(x => x.macroName)
      })
    }
    if (plugin.pluginConfig.templates && plugin.pluginConfig.templates.length > 0) {
      list.push({
        title: 'Templates',
        items: plugin.pluginConfig.templates.map(x => x.name)
      })
    }
    return list
  }

  const model = {
    currentSection: 'Plugins',
    headerSubNavItems: getPageNavLinks(req),
    plugin,
    pluginDescription: plugin?.pluginConfig?.meta?.description,
    version: plugin.version,
    releaseTimeSummary: plugin.releaseDateTime && getTimeSummary(new Date(plugin.releaseDateTime)),
    inThisPlugin: getInThisPluginDetails(),
    preparedPluginLinks: {
      documentation: replaceUrlVars(plugin?.pluginConfig?.meta?.urls?.documentation),
      versionHistory: replaceUrlVars(plugin?.pluginConfig?.meta?.urls?.versionHistory),
      releaseNotes: replaceUrlVars(plugin?.pluginConfig?.meta?.urls?.releaseNotes)
    }
  }

  const latestVersion = await latestVersionPromise
  const installedVersion = await installedVersionPromise

  if (latestVersion?.version && latestVersion.version !== plugin.version) {
    model.newerLink = latestVersion.links.pluginDetails
    model.newerVersion = latestVersion.version
  }
  if (installedVersion?.version && installedVersion.version !== plugin.version) {
    model.installedLinkAsDifferentLink = installedVersion.links.pluginDetails
    model.installedLinkAsDifferentVersion = installedVersion.version
  }
  if (installedVersion?.version && latestVersion?.version !== installedVersion?.version) {
    model.updateLink = latestVersion?.links?.update
  }
  if (await isInstalled(plugin.internalRef)) {
    if (!getRequiredPlugins().includes(plugin.packageName)) {
      model.uninstallLink = plugin.links.uninstall
    }
  } else {
    model.installLink = plugin.links.install
  }
  if (installedVersion?.version !== plugin.version) {
    model.installLink = plugin.links.install
    model.installLinkText = 'Install'

    if (model.newerLink) {
      model.installLinkText = 'Install this version'
    }
  }

  if (config.showPluginDebugInfo) {
    model.debugInfo = [
      '',
      'versions:',
      '',
      `viewing: ${plugin?.version}`,
      `latest: ${latestVersion?.version}`,
      `installed: ${installedVersion?.version}`,
      '',
      'origin:',
      '',
      `viewing: ${plugin?.origin}`,
      `latest: ${latestVersion?.origin}`,
      `installed: ${installedVersion?.origin}`
    ].join('\n')
  }

  res.set('Cache-control', 'no-cache, no-store')

  res.render(getManagementView('plugins/details.njk'), model)
}

async function getRelatedPluginsForUninstall (chosenPlugin) {
  const installed = await getInstalledPackages()
  return installed.filter(x => {
    return (x.pluginConfig?.pluginDependencies || []).some(y => (y.packageName || y) === chosenPlugin.packageName)
  })
}

async function getRelatedPluginsForInstallOrUpdate (chosenPlugin) {
  const output = {}
  const installed = (await getInstalledPackages()).map(x => x.packageName)

  async function addDependenciesToOutputRecursive (plugin) {
    const deps = plugin.pluginConfig?.pluginDependencies || []
    const depsAsObjects = (await Promise.all(deps.map(dep => getLatestPluginDetailsFromNpm(dep.packageName || dep))))
      .filter(depObj => {
        return !Object.keys(output).includes(depObj.internalRef) && !installed.includes(depObj.packageName)
      })

    depsAsObjects.forEach(x => {
      output[x.internalRef] = x
    })

    await Promise.all(depsAsObjects.map(depObj => addDependenciesToOutputRecursive(depObj)))

    return output
  }

  await addDependenciesToOutputRecursive(chosenPlugin)
  return Object.values(output)
}

async function getPluginsModeHandler (req, res, next) {
  const isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin'
  const { packageRef, mode } = req.params
  const verb = verbs[mode]

  const plugin = await getPluginDetailsFromRef(packageRef)

  const err = getErrorIfModeNotAllowedForPlugin(mode, plugin)

  if (err) {
    return next(err)
  }

  let command = plugin?.commands && plugin?.commands[mode]

  if (!plugin) {
    const err = new Error('Plugin not found.')
    err.status = 404
    return next(err)
  }

  if (!command) {
    const err = new Error(`Command not found for mode "${mode}", options are ${Object.keys(plugin?.commands || {}).join(', ')}`)
    err.status = 404
    return next(err)
  }

  const pageName = `${verb.title} ${plugin.name}`

  let returnLink
  let cancelLink = plugin?.links.pluginDetails

  if (req.query.returnTo === 'templates') {
    returnLink = {
      href: `${contextPath}/templates`,
      text: 'Back to templates'
    }
    cancelLink = returnLink.href
  } else if (mode === 'uninstall') {
    returnLink = {
      href: `${contextPath}/plugins`,
      text: 'Back to plugins'
    }
  } else {
    returnLink = {
      href: `${contextPath}/plugin/installed:${encodeURIComponent(plugin.packageName)}`,
      text: 'Back to plugin details'
    }
  }

  let dependencyHeading = ''

  const relatedPlugins = mode === 'uninstall' ? await getRelatedPluginsForUninstall(plugin) : await getRelatedPluginsForInstallOrUpdate(plugin)

  if (relatedPlugins.length > 0) {
    const plural = relatedPlugins.length > 1
    dependencyHeading = `To ${mode} this plugin, you also need to ${mode === 'update' ? 'install' : mode} ${(plural ? 'other plugins' : 'another plugin')}`
  }

  relatedPlugins.forEach(plugin => {
    if (plugin?.commands && plugin?.commands[mode]) {
      command += `; ${plugin?.commands[mode]}`
    }
  })

  res.render('plugins/install-or-uninstall.njk', {
    ...req.app.locals,
    currentSection: 'Plugins',
    pageName,
    currentUrl: req.originalUrl,
    headerSubNavItems: getPageNavLinks(req),
    plugin,
    command,
    dependencyHeading,
    verb,
    isSameOrigin,
    returnLink,
    cancelLink,
    relatedPlugins,
    requiresUserInput: relatedPlugins.length > 0 || !isSameOrigin
  })
}

function getErrorIfModeNotAllowedForPlugin (mode, plugin) {
  if (mode === 'uninstall') {
    if (getRequiredPlugins().includes(plugin.packageName)) {
      const err = new Error('Uninstall restricted for this plugin')
      err.status = 403
      return err
    }
  }
}

async function runPluginMode (req, res, next) {
  const { mode, packageRef } = req.params
  const plugin = await getPluginDetailsFromRef(packageRef)

  const err = getErrorIfModeNotAllowedForPlugin(mode, plugin)

  if (err) {
    return next(err)
  }

  let command = plugin.commands && plugin.commands[mode]

  if (mode === 'uninstall') {
    const related = await getRelatedPluginsForUninstall(plugin)
    command = command.replace('npm uninstall ', `npm uninstall ${related.map(x => x.packageName).join(' ')} `)
  } else {
    const related = await getRelatedPluginsForInstallOrUpdate(plugin)
    command = command.replace('npm install ', `npm install ${related.map(x => x.packageName).join(' ')} `)
  }

  res.send(queueCommand(command))
}

function getRequiredPlugins () {
  return []
}

function legacyUpdateStatusCompatibilityHandler (req, res) {
  if (req.body.package === 'govuk-prototype-kit') {
    res.send({ status: 'completed' })
  }
}

module.exports = {
  contextPath,
  csrfProtection: [doubleCsrfProtection, csrfErrorHandler],
  getCsrfTokenHandler,
  getTemplatesHandler,
  getTemplatesViewHandler,
  getTemplatesInstallHandler,
  postTemplatesInstallHandler,
  getTemplatesPostInstallHandler,
  getPluginsHandler,
  postPluginsHandler,
  getPluginDetailsHandler,
  postPluginDetailsHandler,
  getPluginsModeHandler,
  runPluginMode,
  legacyUpdateStatusCompatibilityHandler,
  getPluginLookupHandler
}
