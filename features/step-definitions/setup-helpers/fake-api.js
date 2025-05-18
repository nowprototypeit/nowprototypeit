const { fork } = require('../../../lib/exec')
const path = require('node:path')
const { findAvailablePortWithoutUser } = require('./findPort')
const { addShutdownFn } = require('../../../lib/utils/shutdownHandlers')
const { verboseLog } = require('../../../lib/utils/verboseLogger')

let singletonFakeApi = null

async function setupFakeApi () {
  if (singletonFakeApi) {
    return singletonFakeApi
  }
  const port = await findAvailablePortWithoutUser()
  const showFakeApiLogs = process.env.SHOW_FAKE_API_STDIO === 'true'
  const config = {
    env: {
      PORT: port,
      NPI_FAKE_API__LOG_ALL_REQUESTS: '' + showFakeApiLogs
    },
    hideStdout: !showFakeApiLogs,
    hideStderr: !showFakeApiLogs
  }
  verboseLog(`Starting fake API on port ${port} with config [${JSON.stringify(config)}]`, process.pid)
  const forked = fork(path.join(__dirname, '..', '..', 'fake-hosted-services', 'fake-api', 'start-fake-api-entrypoint.js'), config)

  const baseUrl = `http://localhost:${port}`

  async function setHostingConfigForVersion (version, isCompatible, message) {
    const body = {
      isCompatible
    }
    if (isCompatible) {
      body.loggedOutMessage = message
      body.hostingBaseUrl = '{{SELF_URL}}/hosting-service-which-is-really-a-separate-server-cluster' // I've specified an out of range port as we don't have a real URL yet
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

  async function setupFakeUser (username, additionalOptions = {}) {
    const body = {
      username,
      ...additionalOptions
    }
    await fetch(baseUrl + '/__fake__/allow-single-login', {
      method: 'POST',
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
    setupFakeUser,
    close,
    reset
  }
  singletonFakeApi = self
  return self
}

module.exports = {
  setupFakeApi
}
