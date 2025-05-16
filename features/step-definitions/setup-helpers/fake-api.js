const { fork } = require('../../../lib/exec')
const path = require('node:path')
const { findAvailablePortWithoutUser } = require('./findPort')
const { addShutdownFn } = require('../../../lib/utils/shutdownHandlers')

async function setupFakeApi () {
  const port = await findAvailablePortWithoutUser()
  const showFakeApiLogs = process.env.SHOW_FAKE_API_STDIO === 'true'
  const forked = fork(path.join(__dirname, 'fake-api', 'start-fake-api-entrypoint.js'), {
    env: {
      PORT: port,
      NPI_OS_API__LOG_ALL_REQUESTS: '' + showFakeApiLogs
    },
    hideStdout: showFakeApiLogs,
    hideStderr: showFakeApiLogs
  })

  const baseUrl = `http://localhost:${port}`

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

  async function close () {
    if (forked.open) {
      await forked.close()
    }
  }

  addShutdownFn(close)
  return {
    baseUrl,
    setMessagesForVersion,
    close
  }
}

module.exports = {
  setupFakeApi
}
