if (require.main === module) {
  global.isRunningAsPartOfFakeApiProcess = true
  const { listenForShutdown } = require('../../../lib/utils/shutdownHandlers')
  listenForShutdown('opensource api setup for tests')
  const express = require('express')
  const { resetMessages, messagesRouter } = require('./routers/messages.js')
  const { resetHosting, hostingRouter, setBaseUrlForHostingRouter } = require('./routers/hosting-config.js')
  const { authRouter, resetAuth, setBaseUrlForAuthRouter } = require('./routers/auth')

  const app = express()
  const port = process.env.PORT
  const logAllRequests = process.env.NPI_FAKE_API__LOG_ALL_REQUESTS === 'true'

  if (!port || isNaN(port)) {
    console.error('No valid PORT environment variable provided')
    throw new Error('this process requires a PORT environment variable')
  }

  if (logAllRequests) {
    app.use((req, res, next) => {
      console.log('Request:', req.method, req.url)
      next()
    })
  }

  app.post('/__reset-everything__', (req, res) => {
    resetMessages()
    resetHosting()
    resetAuth()
    res.send({ success: true })
  })

  app.use(messagesRouter)
  app.use(hostingRouter)
  app.use(authRouter)

  app.use((req, res) => {
    res.status(405)
    res.setHeader('Allow', '')
    res.send({ error: 'Method not allowed, this endpoint may not exist.' })
  })

  const listener = app.listen(port, () => {
    const baseUrl = `http://localhost:${listener.address().port}`
    console.log(`Fake API is listening on ${baseUrl}/`)
    setBaseUrlForAuthRouter(baseUrl)
    setBaseUrlForHostingRouter(baseUrl)
  })
}
