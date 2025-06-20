const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')
const fse = require('fs-extra')
const requestHttps = require('./requestHttps')
const { preparePackageNameForDisplay, getKnownPlugins, getProxyPluginConfig } = require('../plugins/plugins')
const { projectDir } = require('./paths')
const encode = encodeURIComponent
const { cacheFunctionCalls } = require('./functionCache')
const { getConfig } = require('../config')
const { sortByObjectKey, setupPromise } = require('./index')
const { extractTarGzFilesFromPipe } = require('./tarGz')

const packageJsonFilePath = path.join(projectDir, 'package.json')
const contextPath = 'manage-prototype'
const doesntExistResponse = {
  exists: false
}

const encodeRef = ref => encode(ref).replaceAll('%3A', ':')

const requestJson = cacheFunctionCalls((url) => requestHttps.requestHttpsJson(url), { maxTimeMinutes: 20 })

const errorResult = (errorDetails, additionalDetails = undefined) => ({
  error: true,
  errorDetails,
  additionalDetails
})

async function getPluginDetailsFromNpm (packageName, version) {
  if (!version) {
    throw new Error('No version specified, version must be specified')
  }
  try {
    let registerEntry
    try {
      registerEntry = await requestJson(`https://registry.npmjs.org/${encode(packageName)}`)
    } catch (e) {
      if (e.statusCode === 404) {
        return doesntExistResponse
      }
      console.error('non-404 error when requesting registry (a)')
      throw e
    }
    const versionConfig = registerEntry.versions[version]
    if (versionConfig) {
      const npmIdentifier = `${registerEntry.name}@${version}`
      return await addStandardDetails({
        exists: true,
        packageName: registerEntry.name,
        version,
        releaseDateTime: registerEntry.time[version],
        npmIdentifier,
        legacyInstallQueryString: `?package=${encode(packageName)}&version=${encode(version)}`,
        internalRef: `npm:${packageName}:${version}`,
        origin: 'NPM',
        pluginConfig: await requestHttps.getPluginConfigContentsFromNodeModule(versionConfig.dist.tarball, getPluginConfig)
      })
    } else {
      return doesntExistResponse
    }
  } catch (e) {
    console.error('error looking up plugin from npm', e)
    return errorResult(e)
  }
}

async function getLatestPluginDetailsFromNpm (packageName) {
  try {
    let result
    try {
      const registerEntry = await requestJson(`https://registry.npmjs.org/${encode(packageName)}`)
      let versionTag = 'latest'
      if (getConfig().showPrereleases) {
        versionTag = Object.keys(registerEntry['dist-tags']).map(tag => ({
          tag,
          date: registerEntry.time[registerEntry['dist-tags'][tag]]
        })).sort(sortByObjectKey('date')).at(-1).tag
      }
      result = await self.getPluginDetailsFromNpm(packageName, registerEntry['dist-tags'][versionTag])
    } catch (e) {
      if (e.statusCode === 404) {
        return doesntExistResponse
      }
      console.error('non-404 error when requesting registry (b)')
      throw e
    }
    result.internalRef = `npm:${result.packageName}:${result.version}`
    return addStandardDetails(result)
  } catch (e) {
    console.error('error looking up latest plugin from npm', e)
    return errorResult(e)
  }
}

async function getPluginDetailsFromGithub (org, project, branch) {
  try {
    let githubDetails
    const url = `https://api.github.com/repos/${encode(org)}/${encode(project)}`
    try {
      githubDetails = await requestJson(url)
    } catch (e) {
      if (e.statusCode === 404) {
        return doesntExistResponse
      }
      if (e.statusCode === 403) {
        console.error('Github permission denied, this might be because your API rate limit was hit')
        return errorResult('Github API rate limit hit', `Try again in about an hour and it should work, in the meantime you can visit this plugin at https://github.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}${branch ? `/tree/${encodeURIComponent(branch)}` : ''}.`)
      }
      console.error(`Unexpected error when looking up in Github [${url}]`, e)
      throw e
    }
    const chosenBranch = branch || githubDetails.default_branch
    const updatedTimePromise = requestJson(githubDetails.branches_url.replace('{/branch}', '/' + chosenBranch))
      .then(x => x.commit.commit.author.date)
      .catch(_ => undefined)
    const getJsonFileContentsFromGithubApi = async path => JSON.parse(await requestJson(githubDetails.contents_url.replace('{+path}', `${encode(path)}`) + `?ref=${encode(chosenBranch)}`).then(result => Buffer.from(result.content, 'base64').toString()))
    const packageJsonContents = await getJsonFileContentsFromGithubApi('/package.json').catch(e => undefined)
    if (!packageJsonContents) {
      return doesntExistResponse
    }
    const pluginConfigJson = (await Promise.all([
      getJsonFileContentsFromGithubApi('/now-prototype-it.config.json').catch(e => undefined),
      getJsonFileContentsFromGithubApi('/govuk-prototype-kit.config.json').catch(e => undefined)
    ])).filter(x => x !== undefined)[0]
    const pluginConfig = getPluginConfig(pluginConfigJson)
    const npmIdentifier = `github:${org}/${project}` + (branch ? `#${chosenBranch}` : '')
    const packageName = packageJsonContents.name
    const version = packageJsonContents.version
    const refParts = ['github', org, project]
    if (branch) {
      refParts.push(branch)
    }
    return await addStandardDetails({
      exists: true,
      packageName,
      version,
      releaseDateTime: await updatedTimePromise,
      legacyInstallQueryString: `?package=${encode(packageName)}&version=${encode(npmIdentifier)}`,
      npmIdentifier,
      pluginConfig,
      origin: 'Github',
      internalRef: refParts.join(':')
    })
  } catch (e) {
    console.error('error looking up plugin from Github', e)
    return errorResult(e)
  }
}

function getPluginConfig (pluginConfigJson) {
  return (pluginConfigJson && pluginConfigJson['version-2024-03']) || pluginConfigJson
}

async function getConfigFilesFromFsTarGz (pluginPath) {
  const { resolve, reject, promise } = setupPromise()
  extractTarGzFilesFromPipe({
    filesToFind: ['package/now-prototype-it.config.json', 'package/govuk-prototype-kit.config.json', 'package/package.json']
  }, fs.createReadStream(pluginPath), resolve, reject)
  const result = await promise
  const pluginConfigText = result['package/now-prototype-it.config.json'] || result['package/govuk-prototype-kit.config.json']
  const packageJsonText = result['package/package.json']
  return { packageJsonText, pluginConfigText }
}

async function getConfigFilesFromFsDir (pluginPath) {
  const packageJsonText = await fsp.readFile(path.join(pluginPath, 'package.json'), 'utf8').catch(e => undefined)
  const pluginConfigText = (await Promise.all([
    fsp.readFile(path.join(pluginPath, 'now-prototype-it.config.json'), 'utf8').catch(e => undefined),
    fsp.readFile(path.join(pluginPath, 'govuk-prototype-kit.config.json'), 'utf8').catch(e => undefined)
  ])).filter(x => x !== undefined)[0]
  return { packageJsonText, pluginConfigText }
}

async function getPluginDetailsFromFileSystemDir (pluginPath, isDirectory) {
  try {
    const { packageJsonText, pluginConfigText } = isDirectory ? await getConfigFilesFromFsDir(pluginPath) : await getConfigFilesFromFsTarGz(pluginPath)

    if (!packageJsonText) {
      return doesntExistResponse
    }

    const packageJson = JSON.parse(packageJsonText)
    const pluginConfigJson = pluginConfigText && JSON.parse(pluginConfigText)
    const pluginConfig = getPluginConfig(pluginConfigJson)

    const internalRef = `fs:${pluginPath}`
    return await addStandardDetails({
      exists: true,
      packageName: packageJson.name,
      version: packageJson.version,
      queryString: `?package=${encode(packageJson.name)}&version=${encode(pluginPath)}`,
      npmIdentifier: `file:${pluginPath}`,
      origin: 'File System',
      internalRef,
      pluginConfig
    })
  } catch (e) {
    console.error('error looking up plugin from file system', e)
    return errorResult(e)
  }
}

async function getPluginDetailsFromFileSystem (pluginPath) {
  const stats = await fsp.stat(pluginPath).catch(e => undefined)
  if (!stats) {
    return { exists: false }
  }
  return await getPluginDetailsFromFileSystemDir(pluginPath, stats.isDirectory())
}

async function addStandardDetails (config) {
  const updatedConfig = { ...config, ...preparePackageNameForDisplay(config.packageName) }
  const pluginProxyConfig = getProxyPluginConfig()

  updatedConfig.links = {
    pluginDetails: ['', contextPath, 'plugin', updatedConfig.internalRef].map(encodeRef).join('/')
  }
  updatedConfig.links.install = [updatedConfig.links.pluginDetails, 'install'].join('/')
  updatedConfig.links.uninstall = [updatedConfig.links.pluginDetails, 'uninstall'].join('/')
  updatedConfig.links.update = [updatedConfig.links.pluginDetails, 'update'].join('/')

  updatedConfig.commands = updatedConfig.commands || {}
  updatedConfig.commands.uninstall = updatedConfig.commands.uninstall || `npm uninstall ${updatedConfig.packageName}`
  updatedConfig.commands.update = updatedConfig.commands.update || `npm install ${updatedConfig.packageName}@latest --save-exact`
  updatedConfig.commands.install = updatedConfig.commands.install || `npm install ${updatedConfig.npmIdentifier} --save-exact`

  const proxyConfig = pluginProxyConfig[config.packageName] || {}

  Object.keys(proxyConfig).forEach(key => {
    if (!updatedConfig?.pluginConfig || !updatedConfig?.pluginConfig[key]) {
      updatedConfig.pluginConfig = updatedConfig.pluginConfig || {}
      updatedConfig.pluginConfig[key] = proxyConfig[key]
    }
  })

  return updatedConfig
}

async function getInstalledPluginDetails (packageName) {
  try {
    const packageJson = await fse.readJson(packageJsonFilePath)
    const npmId = packageJson.dependencies[packageName]

    if (!npmId) {
      return doesntExistResponse
    }

    const [prefix, id] = npmId.split(':')

    if (prefix === 'github') {
      const [ghid, branch] = id.split('#')
      const [org, project] = ghid.split('/')
      return await getPluginDetailsFromGithub(org, project, branch)
    } else if (prefix === 'file') {
      return await getPluginDetailsFromFileSystem(path.resolve(projectDir, id))
    } else {
      const packageJson = await fse.readJson(path.join(projectDir, 'node_modules', packageName, 'package.json'))
      return await getPluginDetailsFromNpm(packageName, packageJson.version)
    }
  } catch (e) {
    console.error('error looking up plugin details', e)
    return errorResult(e)
  }
}

async function getPluginDetailsFromRef (ref) {
  try {
    const refSafe = ref || ''
    const [source, id, ...extra] = refSafe.split(':')
    const everythingAfterSource = refSafe.substring(refSafe.indexOf(':') + 1)

    if (source === 'installed') {
      return await self.getInstalledPluginDetails(everythingAfterSource)
    }
    if (source === 'fs') {
      return await self.getPluginDetailsFromFileSystem(everythingAfterSource)
    }
    if (source === 'github') {
      if (extra[1]) {
        return await self.getPluginDetailsFromGithub(id, extra[0], extra[1])
      } else {
        return await self.getPluginDetailsFromGithub(id, extra[0])
      }
    }
    if (source === 'npm') {
      if (extra[0]) {
        return await self.getPluginDetailsFromNpm(id, extra[0])
      } else {
        return await self.getLatestPluginDetailsFromNpm(everythingAfterSource)
      }
    }
  } catch (e) {
    console.error('error looking up plugin from ref', e)
    return errorResult(e)
  }
}

async function getInstalledPackages () {
  try {
    const packageJson = await fse.readJson(packageJsonFilePath)

    return (await Promise.all(Object.keys(packageJson.dependencies)
      .filter(x => x !== 'nowprototypeit')
      .map(async packageName => {
        return await getInstalledPluginDetails(packageName)
      })))
      .filter(x => x.exists)
  } catch (e) {
    console.error('error looking up installed packages', e)
    return errorResult(e)
  }
}

async function getInstalledPlugins () {
  const installedPackages = await getInstalledPackages()
  if (installedPackages.error) {
    return installedPackages
  }
  const filtered = installedPackages.filter(plugin => {
    return !!plugin.pluginConfig
  })
  return filtered
}

async function getPluginsForDiscovery () {
  const availablePlugins = getKnownPlugins()
  try {
    return await Promise.all(availablePlugins.map(async packageName => getLatestPluginDetailsFromNpm(packageName)))
  } catch (e) {
    console.error('error getting known plugins', e)
    return errorResult(e)
  }
}

async function isInstalled (ref) {
  try {
    const plugin = await getPluginDetailsFromRef(ref)
    if (!plugin || !plugin.exists) {
      return false
    }
    const isInPackageJson = await fse.readJson(packageJsonFilePath).then(x => Object.keys(x.dependencies).includes(plugin.packageName))
    const isInFileSystem = await fse.exists(path.join(projectDir, 'node_modules', plugin.packageName))
    return isInPackageJson && isInFileSystem
  } catch (e) {
    console.error('error looking up plugin from npm', e)
    return errorResult(e)
  }
}

const self = {
  getInstalledPlugins,
  getInstalledPackages,
  getPluginsForDiscovery,
  getPluginDetailsFromFileSystem,
  getInstalledPluginDetails,
  getPluginDetailsFromRef,
  isInstalled
}

self.getPluginDetailsFromGithub = cacheFunctionCalls(getPluginDetailsFromGithub, { maxTimeMinutes: 20 })
self.getPluginDetailsFromNpm = cacheFunctionCalls(getPluginDetailsFromNpm, { maxTimeMinutes: 120 })
self.getLatestPluginDetailsFromNpm = cacheFunctionCalls(getLatestPluginDetailsFromNpm, { maxTimeMinutes: 20 })

module.exports = self
