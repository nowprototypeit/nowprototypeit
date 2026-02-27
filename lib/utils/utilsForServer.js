const { existsSync } = require('fs')
const path = require('path')
const { projectDir, appDir, appViewsDir } = require('./paths')
const filters = require('../filters/api')
const fs = require('fs')
const { runWhenEnvIsAvailable: runWhenFiltersEnvIsAvailable } = require('../filters/api')
const plugins = require('../plugins/plugins')
const routes = require('../routes/api')
const functions = require('../functions/api')
const { runWhenEnvIsAvailable: runWhenFunctionsEnvIsAvailable } = require('../functions/api')
const { addMarkdownRendererFromPlugin } = require('../markdownRenderers/api')
const { getPathToViewFile } = require('../nunjucks/utils')
const appViews = plugins.getAppViews([appViewsDir])
const { getConfig } = require('../config')
const { renderPhp } = require('../other-languages/php-pages')

async function renderPath (urlPath, relativePathToViewFile, res, next) {
  const model = {}
  // Try to render the path
  res.render(urlPath, model, async (error, html) => {
    if (!error) {
      const pathToView = path.relative(projectDir, relativePathToViewFile)
      // Success - send the response
      res.set({ 'Content-type': 'text/html; charset=utf-8' })
      if (pathToView && !pathToView.startsWith('node_modules')) {
        res.set({
          'x-npi-edit-page-info': JSON.stringify({
            mainViewFile: pathToView
          })
        })
      }
      res.end(html)
      return
    }
    if (!error.message.startsWith('template not found')) {
      // We got an error other than template not found - call next with the error
      next(error)
      return
    }
    if (!urlPath.endsWith('/index')) {
      // Maybe it's a folder - try to render [path]/index.njk
      await renderPath(urlPath + '/index', relativePathToViewFile, res, next)
      return
    }
    // We got template not found both times - call next to trigger the 404 page
    next()
  })
}

function forceHttps (req, res, next) {
  if (req.protocol !== 'https') {
    console.log('Redirecting request to https')
    // 302 temporary - this is a feature that can be disabled
    return res.redirect(302, 'https://' + req.get('Host') + req.url)
  }

  // Mark proxy as secure (allows secure cookies)
  req.connection.proxySecure = true
  next()
}

const prototypeAppScripts = []
if (existsSync(path.join(projectDir, 'app', 'assets', 'javascripts', 'application.js'))) {
  prototypeAppScripts.push({
    src: '/public/javascripts/application.js',
    type: 'module'
  })
}

function addNunjucksFilters (env) {
  filters.setEnvironment(env)
  const additionalFilters = []
  const filtersPath = path.join(appDir, 'filters.js')
  if (fs.existsSync(filtersPath)) {
    additionalFilters.push(filtersPath)
  }
  runWhenFiltersEnvIsAvailable(() => {
    plugins.getFileSystemPaths('nunjucksFilters').concat(additionalFilters).forEach(x => require(x))
  })
}

function addRouters (app) {
  routes.setApp(app)
  const routesPath = path.join(appDir, 'routes.js')
  if (fs.existsSync(routesPath)) {
    require(routesPath)
  }
}

async function matchRoutes (req, res, next) {
  let filePath = decodeURI(req.path).normalize()

  // Remove the first slash, render won't work with it
  filePath = filePath.substr(1)

  // If it's blank, render the root index
  if (filePath === '') {
    filePath = 'index'
  }

  const pathToViewFile = getPathToViewFile(filePath, appViews)

  console.log('!!!!!!!!! Path to view file:', pathToViewFile)
  console.log('!!!! Local', req.session && req.session.userInput)

  const config = getConfig()
  if (config.respectFileExtensions) {
    if (pathToViewFile && pathToViewFile.endsWith('.php')) {
      res.set({ 'Content-type': 'text/html; charset=utf-8' })
      res.set({
        'x-npi-edit-page-info': JSON.stringify({
          mainViewFile: path.relative(projectDir, pathToViewFile)
        })
      })
      const result = await renderPhp(pathToViewFile, (req.session && req.session.userInput) || {})
      if (result.success) {
        return res.send(result.contents)
      } else {
        if (config.showJsonErrors) {
          res.send({
            errorToBeDisplayedNicely: true,
            isNunjucksError: false,
            ...result.details
          })
        } else {
          console.log(result.err)
          res.render('prototype-core/views/error.njk', {
            heading: 'An error occurred',
            message: result.details
          })
        }
      }
    }
  }
  await renderPath(filePath, pathToViewFile, res, next)
}

function addNunjucksFunctions (env) {
  functions.setEnvironment(env)
  const additionalFunctions = []
  const functionsPath = path.join(appDir, 'functions.js')
  if (fs.existsSync(functionsPath)) {
    additionalFunctions.push(functionsPath)
  }
  runWhenFunctionsEnvIsAvailable(() => {
    const globalFiles = plugins.getFileSystemPaths('nunjucksFunctions').concat(additionalFunctions)
    globalFiles.forEach(x => require(x))
  })
}

function addMarkdownRenderers () {
  const globalFiles = plugins.getByTypeWithPathExpanded('markdownRenderers')
  globalFiles.forEach(({ packageName, item }) => {
    if (!item.name || !item.path || item.name.trim().length === 0 || item.path.trim().length === 0) {
      console.error('Invalid markdown renderer configuration', item)
      return
    }
    let result
    try { result = require(item.path) } catch (e) { console.error(`Failed to load markdown renderer from [${item.path}]`) }
    if (result && typeof result.markdownRenderer === 'function') {
      addMarkdownRendererFromPlugin(packageName, item.name, result.markdownRenderer)
    } else {
      console.error(`Failed to load markdown renderer from config item [${JSON.stringify(item)}]`)
    }
  })
}

module.exports = {
  forceHttps,
  prototypeAppScripts,
  addNunjucksFilters,
  addRouters,
  matchRoutes,
  addNunjucksFunctions,
  addMarkdownRenderers
}
