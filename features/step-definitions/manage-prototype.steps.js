const { Given, Then, When } = require('@cucumber/cucumber')
const { standardTimeout } = require('./setup-helpers/timeouts')
const { expect } = require('./utils')

Given('the API contains a message for this version of the kit saying {string}', standardTimeout, function (messageText) {
  this.fakeApi.setMessagesForVersion(this.kit.version, false, [
    { text: messageText }
  ])
})

Given('Hosting is enabled for this version of the kit with logged out message {string}', standardTimeout, async function (message) {
  await this.fakeApi.setHostingConfigForVersion(this.kit.version, true, message)
})

Given('Hosting is disabled for this version of the kit with message {string}', standardTimeout, async function (message) {
  await this.fakeApi.setHostingConfigForVersion(this.kit.version, false, message)
})

When('I visit the manage prototype homepage', standardTimeout, async function () {
  await this.browser.openUrl('/manage-prototype')
})

Then('I should only see the message {string}', standardTimeout, async function (oneAndOnlyMessage) {
  const messages = await this.browser.getTextFromSelectorAll('.nowprototypeit-manage-prototype-messages li')
  ;(await expect(messages)).to.contain(oneAndOnlyMessage)
  const length = messages.length
  if (length > 1) {
    throw new Error(`Expected only one message, but found ${length}: ${messages.join(', ')}`)
  }
})

Then('I should not see any messages', standardTimeout, async function () {
  const messagesElementExists = await this.browser.hasSelector('.nowprototypeit-manage-prototype-messages')
  if (messagesElementExists) {
    throw new Error('Expected no messages, but found the messages element')
  }
})
