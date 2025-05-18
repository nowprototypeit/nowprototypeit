const { Given, Then, When } = require('@cucumber/cucumber')
const { standardTimeout } = require('./setup-helpers/timeouts')
const { waitForConditionToBeMet } = require('./utils')

Given('the API contains a message for this version of the kit with text {string}', standardTimeout, async function (messageText) {
  await this.fakeApi.setMessagesForVersion(this.kit.version, false, [
    messageText
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
  const length = messages.length
  const firstMessageMatches = messages[0] === oneAndOnlyMessage
  if (length > 1 || !firstMessageMatches) {
    throw new Error(`Expected only one message matching [${oneAndOnlyMessage}], but found [${length}]: [${messages.map(JSON.stringify).join(', ')}]`)
  }
})
Then('I should not see any messages', standardTimeout, async function () {
  const messagesElementExists = await this.browser.hasSelector('.nowprototypeit-manage-prototype-messages')
  if (messagesElementExists) {
    throw new Error('Expected no messages, but found the messages element')
  }
})
Then('the first message should contain bold text saying {string}', standardTimeout, async function (boldTextContent) {
  const boldText = await this.browser.getTextFromSelectorAll('.nowprototypeit-manage-prototype-messages li:first-of-type strong')
  if (!boldText.includes(boldTextContent)) {
    throw new Error(`Expected bold text to contain [${boldTextContent}], but found [${boldText.join(', ')}]`)
  }
})

Then('the first message should contain italic text saying {string}', standardTimeout, async function (boldTextContent) {
  const boldText = await this.browser.getTextFromSelectorAll('.nowprototypeit-manage-prototype-messages li:first-of-type em')
  if (!boldText.includes(boldTextContent)) {
    throw new Error(`Expected bold text to contain [${boldTextContent}], but found [${boldText.join(', ')}]`)
  }
})

Then('the first message should contain a link to {string}', standardTimeout, async function (linkTextAndUrl) {
  const linkTextAndUrlList = await this.browser.getLinkTextAndUrlFromSelectorAll('.nowprototypeit-manage-prototype-messages li:first-of-type a')
  const index = linkTextAndUrlList.findIndex(x => x.text === linkTextAndUrl)
  if (index === -1) {
    throw new Error(`Expected link to contain [${linkTextAndUrl}], but found [${linkTextAndUrlList.map(x => x.text).join(', ')}]`)
  }
  const found = linkTextAndUrlList[index]
  if (found.text !== found.url) {
    throw new Error(`Expected link text to be the same as the URL, but found text [${found.text}] and url [${found.url}]`)
  }
})

When('I login with username as {string} in the fake website popup window', standardTimeout, async function (username) {
  await this.browser.loginInFakeWebsitePopupWindow(username)
})
When('I enter the one-time-password as {string} in the fake website popup window', standardTimeout, async function (username) {
  await this.browser.enterOtpFakeWebsitePopupWindow(username)
})
When('the popup window should be closed', standardTimeout, async function () {
  let number = -1
  await waitForConditionToBeMet(standardTimeout, async () => {
    number = await this.browser.getNumberOfFakeWebsitePopupWindows()
    return number === 0
  }, (reject) => {
    reject(new Error(`Expected one popup window, found [${number}]`))
  })
})
Given('the fake api expects a login from {string} with {int}\\/{int} prototypes used', standardTimeout, async function (username, usedPrototypes, totalPrototypeAllowance) {
  await this.fakeApi.setupFakeUser(username, {
    uploadCapacity: totalPrototypeAllowance,
    uploadedCount: usedPrototypes
  })
})
Then('the username on the page should be {string}', standardTimeout, async function (username) {
  let foundUsername
  await waitForConditionToBeMet(standardTimeout, async () => {
    foundUsername = await this.browser.getTextFromSelector('.nowprototypeit-user-name')
    return foundUsername === username
  }, (reject) => {
    reject(new Error(`Expected username [${username}], but found [${foundUsername}]`))
  })
})
