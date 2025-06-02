const chained = chainFns(
  stripHtmlTags,
  addBoldTags,
  addItalicTags,
  addLinks
)

function prepareMessagesFromApi (messageResponse) {
  const staticMessages = []
  if (messageResponse.upgradeAvailable) {
    staticMessages.push({
      html: '<a href="/manage-prototype/plugin/npm:nowprototypeit">An update is available, install it now.</a>'
    })
  }
  return [...staticMessages].concat(messageResponse.messages.map(prepareMessageFromApiAsHtml))
}

function prepareMessageFromApiAsHtml (text) {
  return { html: chained(text) }
}

module.exports = {
  prepareMessagesFromApi,
  prepareMessageFromApiAsHtml
}

function chainFns (...fns) {
  return function (text) {
    return fns.reduce((acc, fn) => fn(acc), text)
  }
}

function addBoldTags (text) {
  return text.replaceAll(/\*\*(\w.*?\w)\*\*/g, '<strong>$1</strong>')
}

function addItalicTags (text) {
  return text.replaceAll(/\*(\w.*?(\w))\*/g, '<em>$1</em>')
}

function addLinks (text) {
  return text.replaceAll(/\(link:([^ ]+)\)/g, '<a href="$1">$1</a>')
}

function stripHtmlTags (text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
