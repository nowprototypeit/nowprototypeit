// core dependencies
const path = require('path')
const url = require('url')

// npm dependencies
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')
const express = require('express')
const { expressNunjucks, getNunjucksAppEnv, stopWatchingNunjucks } = require('./lib/nunjucks/nunjucksConfiguration')

// We want users to be able to keep api keys, config variables and other
// envvars in a `.env` file, run dotenv before other code to make sure those
// variables are available
dotenv.config()

// Local dependencies
const { projectDir, appViewsDir, finalBackupNunjucksDir } = require('./lib/utils/paths')
const config = require('./lib/config.js').getConfig()
const packageJson = require('./package.json')
const utils = require('./lib/utils')
const sessionUtils = require('./lib/session.js')
const plugins = require('./lib/plugins/plugins.js')
const routesApi = require('./lib/routes/api.js')

const app = express()
routesApi.setApp(app)

// Set up configuration variables
const releaseVersion = packageJson.version

// Force HTTPS on production. Do this before using basicAuth to avoid
// asking for username/password twice (for `http`, then `https`).
const isSecure = (config.isProduction && config.useHttps)
if (isSecure) {
  app.use(utils.forceHttps)
  app.set('trust proxy', 1) // needed for secure cookies on heroku
}

// Add variables that are available in all views
app.locals.asset_path = '/public/'
app.locals.useAutoStoreData = config.useAutoStoreData
app.locals.releaseVersion = 'v' + releaseVersion
app.locals.isRunningInPrototypeKit = true
app.locals.serviceName = config.serviceName
// pluginConfig sets up variables used to add the scripts and stylesheets to each page.
app.locals.pluginConfig = plugins.getAppConfig({
  scripts: utils.prototypeAppScripts
})

utils.addGovukFrontendSpecificValuesToAppLocalSync(app.locals)

plugins.getNunjucksVariables().forEach(({ key, value }) => {
  app.locals[key] = value
})

// Support session data storage
app.use(sessionUtils.getSessionMiddleware())

// use cookie middleware for reading authentication cookie
app.use(cookieParser())

// Authentication middleware must be loaded before other middleware such as
// static assets to prevent unauthorised access
app.use(require('./lib/authentication.js')())

const nunjucksConfig = {
  autoescape: true,
  noCache: true,
  watch: false // We are now setting this to `false` (it's by default false anyway) as having it set to `true` for production was making the tests hang
}

if (config.isDevelopment) {
  nunjucksConfig.watch = true
}

nunjucksConfig.express = app

// but uses the internal package as a backup if uninstalled
const nunjucksAppEnv = getNunjucksAppEnv(
  plugins.getAppViews([appViewsDir, finalBackupNunjucksDir])
)

expressNunjucks(nunjucksAppEnv, app)

// Add Nunjucks filters
utils.addNunjucksFilters(nunjucksAppEnv)

// Add Nunjucks functions
utils.addNunjucksFunctions(nunjucksAppEnv)

function prepareError (err) {
  return {
    name: err.name,
    stack: err.stack,
    code: err.code,
    type: err.type
  }
}

if (config.isDevelopment) {
  const events = require('./lib/dev-server/dev-server-events')
  const eventTypes = require('./lib/dev-server/dev-server-event-types')

  events.listenExternal([eventTypes.TEMPLATE_PREVIEW_REQUEST])

  events.on(eventTypes.TEMPLATE_PREVIEW_REQUEST, (info) => {
    const id = info.id

    const templatePath = info.templatePath

    try {
      nunjucksAppEnv.render(templatePath, {
        ...app.locals
      }, (err, result) => {
        const response = { id }
        if (err) {
          response.error = prepareError(err)
        } else {
          response.result = { html: result }
        }
        events.emitExternal(eventTypes.TEMPLATE_PREVIEW_RESPONSE, response)
      })
    } catch (e) {
      events.emitExternal(eventTypes.TEMPLATE_PREVIEW_RESPONSE, {
        id,
        error: prepareError(e)
      })
    }
  })
}

// Set views engine
app.set('view engine', 'njk')

// Middleware to serve static assets
app.use('/public', express.static(path.join(projectDir, '.tmp', 'public')))
app.use('/public', express.static(path.join(projectDir, 'app', 'assets')))

// Support for parsing data in POSTs
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

// Automatically store all data users enter
if (config.useAutoStoreData) {
  app.use(sessionUtils.autoStoreData)
  sessionUtils.addCheckedFunction(nunjucksAppEnv)
}

// Prevent search indexing
app.use((req, res, next) => {
  // Setting headers stops pages being indexed even if indexed pages link to them.
  res.setHeader('X-Robots-Tag', 'noindex')
  next()
})

require('./lib/plugins/plugins-routes.js')
const { encryptPassword } = require('./lib/utils')

utils.addRouters(app)

// Clear all data in session
// Render password page with a returnURL to redirect people to where they came from
// Check authentication password
app.get('/manage-prototype/password', function (req, res) {
  const error = req.query.error
  res.render('prototype-core/views/password.njk', {
    ...req.app.locals,
    error,
    currentUrl: req.originalUrl
  })
})

app.post('/manage-prototype/password', function (req, res) {
  const passwords = config.passwords
  const submittedPassword = req.body.password
  const providedUrl = req.query.returnURL

  const processedRedirectUrl = (!providedUrl || providedUrl.startsWith('/manage-prototype/password')) ? '/' : providedUrl
  if (passwords.some(password => submittedPassword === password)) {
    // see lib/middleware/authentication.js for explanation
    res.cookie('authentication', encryptPassword(submittedPassword), {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: 'None', // Allows GET and POST requests from other domains
      httpOnly: true,
      secure: true
    })
    res.redirect(processedRedirectUrl)
  } else {
    res.redirect('/manage-prototype/password?error=wrong-password&returnURL=' + encodeURIComponent(processedRedirectUrl))
  }
})

app.get('/manage-prototype/clear-data', function (req, res) {
  if (!req.query.returnUrl && req.headers.referer) {
    const relativeUrl = '/' + (req.headers.referer.split('/').slice(3).join('/') || '')
    res.redirect(req.originalUrl + (req.originalUrl.includes('?') ? '&' : '?') + 'returnUrl=' + encodeURIComponent(relativeUrl))
    return
  }
  res.render('prototype-core/views/clear-data.njk', {
    ...req.app.locals,
    currentUrl: req.originalUrl
  })
})

app.post('/manage-prototype/clear-data', function (req, res) {
  req.session.data = {}
  res.render('prototype-core/views/clear-data.njk', {
    ...req.app.locals,
    stage: 'completed',
    returnUrl: req.query.returnUrl
  })
})

// Strip .html, .htm and .njk if provided
app.get(/\.(html|htm|njk)$/i, (req, res) => {
  let path = req.path
  const parts = path.split('.')
  parts.pop()
  path = parts.join('.')
  res.redirect(path)
})

// Auto render any view that exists

// App folder routes get priority
app.get(/^([^.]+)$/, async (req, res, next) => {
  await utils.matchRoutes(req, res, next)
})

// Redirect all POSTs to GETs - this allows users to use POST for autoStoreData
app.post(/^\/([^.]+)$/, (req, res) => {
  res.redirect(url.format({
    pathname: '/' + req.params[0],
    query: req.query
  })
  )
})

// redirect old local docs to the docs site
app.get('/docs/tutorials-and-examples', (req, res) => {
  res.redirect('https://prototype-kit.service.gov.uk/docs')
})

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error(`Page not found: ${decodeURI(req.path)}`)
  err.status = 404
  next(err)
})

// Display error
// We override the default handler because we want to customise
// how the error appears to users, we want to show a simplified
// message without the stack trace.

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  if (req.headers['content-type'] && req.headers['content-type'].indexOf('json') !== -1) {
    console.error(err.message)
    res.status(err.status || 500)
    res.send(err.message)
    return
  }
  switch (err.status) {
    case 404: {
      res.status(404)
      if (config.showJsonErrors) {
        res.send({
          errorToBeDisplayedNicely: true,
          originalUrl: req.originalUrl,
          is404: true
        })
      } else {
        res.render('prototype-core/views/error.njk', {
          heading: 'Page not found',
          text: 'The page you are looking for does not exist.'
        })
      }
      break
    }
    default: {
      res.status(500)
      if (config.showJsonErrors) {
        res.send({
          errorToBeDisplayedNicely: true,
          isNunjucksError: true,
          message: err.message,
          type: err.type,
          stack: err.stack,
          name: err.name
        })
      } else {
        res.render('prototype-core/views/error.njk', {
          heading: 'An error occurred',
          text: err.message
        })
      }
      break
    }
  }
})

app.close = stopWatchingNunjucks

module.exports = app
