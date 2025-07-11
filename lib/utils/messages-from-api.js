const { getConfig } = require('../config')
const { requestHttpsJson } = require('./requestHttps')
const { prepareMessagesFromApi } = require('../dev-server/manage-prototype/utils/prepare-messsages-from-api')
const { verboseLog } = require('./verboseLogger')

function getMessages (kitVersion, messageContext, format = 'custom-rich') {
  const partialUrl = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/messages/npi/${encodeURIComponent(kitVersion)}`
  const fullUrl = `${partialUrl}?context=${encodeURIComponent(messageContext)}&format=${encodeURIComponent(format)}`
  verboseLog('Fetching messages from NPI API with URL', fullUrl)
  return requestHttpsJson(fullUrl, {}).then(response => ({
    messages: prepareMessagesFromApi(response),
    docsUrl: response.docsUrl
  })).catch((e) => {
    verboseLog('Error fetching messages from NPI API with URL', fullUrl)
    verboseLog('Error fetching messages from NPI API', e)
  })
}

module.exports = {
  getMessages
}
