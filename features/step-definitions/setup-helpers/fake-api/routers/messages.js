const express = require('express')

const messagesByKitVersion = {}
let defaultMessagesResponse = {}

function resetMessages () {
  defaultMessagesResponse = {
    upgradeAvailable: false,
    messages: []
  }
  Object.keys(messagesByKitVersion).forEach(key => {
    delete messagesByKitVersion[key]
  })
}

const messagesRouter = express.Router()
resetMessages()

messagesRouter.get('/:version', (req, res) => {
  const version = req.params.version
  const messages = messagesByKitVersion[version] || replaceVarsInDefaultMessage({ version })
  res.json(messages)
})

messagesRouter.put('/__default__', [express.json()], (req, res) => {
  defaultMessagesResponse = { ...req.body }
  res.send({ success: true })
})

messagesRouter.put('/:version', [express.json()], (req, res) => {
  messagesByKitVersion[req.params.version] = { ...req.body, version: req.params.version }
  res.send({ success: true })
})

module.exports = {
  resetMessages,
  messagesRouter
}

function replaceVarsInDefaultMessage (vars = {}) {
  return Object.keys(defaultMessagesResponse).reduce((acc, key) => {
    acc[key] = vars[key] ?? defaultMessagesResponse[key]
    return acc
  }, {})
}
