process.on('disconnect', () => {
  process.exit()
})

const express = require('express')
const nunjucks = require('nunjucks')
const app = express()
const eventTypes = require('../dev-server-event-types')
const events = require('../dev-server-events')
const { proxyRemainingRequests } = require('./routes/proxyRemainingRequests')
const { managementPages } = require('./routes/managementPages')
const { refresherServer } = require('./routes/refresherServer')
const path = require('path')
const { monitorEventLoop } = require('../../utils')
const { verboseLog } = require('../../utils/verboseLogger')
const { generateManagePrototypeCssIfNecessary, getPathToDesignSystemNunjucks } = require('./build')
const { editInBrowser } = require('./routes/editInBrowser')
const port = process.env.PORT
const config = {
  startDate: new Date().toISOString()
}

function updateLastReload () {
  config.lastReload = new Date().getTime()
}

app.locals.nowPrototypeItDesignSystemAssetsPath = '/manage-prototype/now-prototype-it-design-system/assets'
app.locals.nowPrototypeItStylesheetInclude = 'includes/stylesheets.njk'
app.locals.nowPrototypeItScriptInclude = 'includes/scripts.njk'
app.locals.nowPrototypeItLogoLink = 'https://nowprototype.it/'

monitorEventLoop('manage-prototype')

updateLastReload()

events.listenExternal([eventTypes.KIT_STARTED, eventTypes.TEMPLATE_PREVIEW_RESPONSE, eventTypes.FULL_KIT_RESTART])

events.on(eventTypes.KIT_STARTED, (obj) => {
  const isFirst = !config.currentKitPort

  verboseLog('kit running on ', obj.port)

  config.currentKitPort = obj.port
  config.lastKnownError = undefined

  events.emit(eventTypes.RELOAD_PAGE)

  if (isFirst) {
    console.log('')
    console.log('You can manage your prototype at:')
    console.log(`http://localhost:${port}/manage-prototype`)
    console.log('')
    console.log('The Prototype Kit is now running at:')
    console.log(`http://localhost:${port}`)
    console.log('')
  } else {
    console.log('Your prototype was restarted.')
  }
})

events.on(eventTypes.KIT_STOPPED, (info) => {
  if (info.code !== null && info.code !== 0) {
    config.currentKitPort = undefined
    config.lastKnownError = info
    console.log(`There's an error, you can see it above or at http://localhost:${port}`)
    console.log('')
    events.emit(eventTypes.RELOAD_PAGE)
  }
})

events.on(eventTypes.KIT_SASS_REGENERATED, () => {
  events.emit(eventTypes.RELOAD_PAGE)
})
events.on(eventTypes.RELOAD_PAGE, () => {
  updateLastReload()
})

events.on(eventTypes.KIT_SASS_ERROR, (info) => {
  console.error('Sass failed to compile', info?.error?.stack)
})

const cssPromise = generateManagePrototypeCssIfNecessary()

const templatesPath = [
  path.join(__dirname, 'views'),
  path.join(__dirname, '..', '..', 'nunjucks'),
  getPathToDesignSystemNunjucks(),
  path.join(getPathToDesignSystemNunjucks(), 'now-prototype-it-design-system')
]

nunjucks.configure(templatesPath, {
  autoescape: true,
  express: app
})

app.set('view engine', 'njk')

;(async () => {
  await refresherServer(app, config)
  await editInBrowser(app, config)
  await managementPages(app, config)
  await proxyRemainingRequests(app, config)

  const listener = app.listen(port, async (err) => {
    const actualPort = listener.address().port
    if (err) {
      throw err
    }
    await cssPromise
    events.emitExternal(eventTypes.MANAGEMENT_STARTED, {
      port: actualPort
    })
  })
})()
