const os = require('node:os')
const { listenForShutdown } = require('../../utils/shutdownHandlers')
listenForShutdown('manage-prototype')
const express = require('express')
const nunjucks = require('nunjucks')
const app = express()
const eventTypes = require('../dev-server-event-types')
const events = require('../dev-server-events')
const path = require('path')
const { monitorEventLoop, findAvailablePortWithUser } = require('../../utils')
const { generateManagePrototypeCssIfNecessary } = require('./build')
const { setAppLocals, getTemplatesPaths } = require('./utils')
const { justUploadPages } = require('./routes/managementPages')
const portPromise = new Promise((resolve) => {
  findAvailablePortWithUser(port => {
    resolve(port)
  })
})

setAppLocals(app)

monitorEventLoop('just-upload')

events.on(eventTypes.KIT_SASS_ERROR, (info) => {
  console.error('Sass failed to compile', info?.error?.stack)
})

const cssPromise = generateManagePrototypeCssIfNecessary()

nunjucks.configure(getTemplatesPaths(), {
  autoescape: true,
  express: app
})

app.set('view engine', 'njk')

;(async () => {
  await justUploadPages(app, {
    prototypeDir: process.cwd(),
    authDir: path.join(os.tmpdir(), 'npi-cloud-login')
  })

  const listener = app.listen(await portPromise, async (err) => {
    const actualPort = listener.address().port
    if (err) {
      throw err
    }
    await cssPromise
    console.log('')
    console.log('')
    console.log('To start your upload, please visit:')
    console.log('')
    console.log(`http://localhost:${actualPort}/manage-prototype/npi-cloud-upload`)
    console.log('')
  })
})()
