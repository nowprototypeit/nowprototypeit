const { fork } = require('../../../lib/exec')
const path = require('node:path')
const { findAvailablePortWithoutUser } = require('./findPort')
const { addShutdownFn } = require('../../../lib/utils/shutdownHandlers')

let singletonFakeApi = null

async function setupFakeApi () {
  if (singletonFakeApi) {
    return singletonFakeApi
  }
  const port = await findAvailablePortWithoutUser()
  const showFakeApiLogs = process.env.SHOW_FAKE_API_STDIO === 'true'
  const forked = fork(path.join(__dirname, 'fake-api', 'start-fake-api-entrypoint.js'), {
    env: {
      PORT: port,
      NPI_OS_API__LOG_ALL_REQUESTS: '' + showFakeApiLogs
    },
    hideStdout: !showFakeApiLogs,
    hideStderr: !showFakeApiLogs
  })

  const baseUrl = `http://localhost:${port}`

  async function setHostingConfigForVersion (version, isCompatible, message) {
    const body = {
      isCompatible
    }
    if (isCompatible) {
      body.loggedOutMessage = message
      body.hostingBaseUrl = 'https://localhost:9999999' // I've specified an out of range port as we don't have a real URL yet
    }
    body.messageFormattedText = message

    await fetch(baseUrl + `/v1/hosting-config-for-nowprototypeit/${encodeURIComponent(version)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  }

  async function setMessagesForVersion (version, upgradeAvailable, messages) {
    await fetch(baseUrl + `/v1/messages/npi/${encodeURIComponent(version)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version,
        upgradeAvailable,
        messages
      })
    })
  }

  async function reset () {
    await fetch(baseUrl + '/__reset-everything__', {
      method: 'POST'
    })
  }

  async function close () {
    if (forked.open) {
      await forked.close()
    }
  }

  addShutdownFn(close)
  const self = {
    baseUrl,
    setMessagesForVersion,
    setHostingConfigForVersion,
    close,
    reset
  }
  singletonFakeApi = self
  return self
}

module.exports = {
  setupFakeApi
}
