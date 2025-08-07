const { Given, When, Then } = require('@cucumber/cucumber')
const { expect, waitForConditionToBeMet } = require('./utils')
const { standardTimeout, mediumActionTimeout, tinyTimeout } = require('./setup-helpers/timeouts')

Given('I am on the plugin settings page for the {string} plugin', standardTimeout, async function (pluginName) {
  await this.browser.openUrl('/manage-prototype/settings')
  await this.browser.clickPluginSettingsForPluginNameOrSettingsCategory(pluginName)
})

Given('I am on the {string} settings page', standardTimeout, async function (pluginName) {
  await this.browser.openUrl('/manage-prototype/settings')
  await this.browser.clickPluginSettingsForPluginNameOrSettingsCategory(pluginName)
})

When('I turn off the {string} setting', mediumActionTimeout, async function (fieldName) {
  const browser = this.browser
  await browser.selectRadioButtonBySelector(`input[type=radio][name=${fieldName}][value=false]`)
})

When('I turn on the {string} setting', mediumActionTimeout, async function (fieldName) {
  const browser = this.browser
  await browser.selectRadioButtonBySelector(`input[type=radio][name=${fieldName}][value=true]`)
})

When('I press {string}', standardTimeout, async function (buttonText) {
  await this.browser.clickButtonWithText(buttonText)
})

Then('I should see the settings saved message', standardTimeout, async function () {
  let lastKnownContent
  const expectedContent = 'Settings saved'
  await waitForConditionToBeMet({ timeout: standardTimeout.timeout * 0.9 }, async () => {
    lastKnownContent = await this.browser.getTextFromSelector('.nowprototypeit-toast', tinyTimeout)
    return lastKnownContent.includes(expectedContent)
  }, (reject) => {
    const summary = lastKnownContent ? `[${lastKnownContent}]` : 'never found'
    reject(new Error(`Expected toast message to be [${expectedContent}], but was ${summary}`))
  })
})

When('I visit the homepage', standardTimeout, async function () {
  await this.browser.openUrl('/')
})

Then('I should see {string} as the service name in the GOV.UK header', standardTimeout, async function (serviceName) {
  const serviceNameElement = (await this.browser.queryClass('govuk-header__service-name'))[0]
  if (!serviceNameElement) {
    throw new Error('Could not find service name element')
  }
  (await expect(await serviceNameElement.getText())).to.eq(serviceName)
})

Then('the service name in the GOV.UK header should become {string}', standardTimeout, async function (string) {
  let actual = null
  await waitForConditionToBeMet(standardTimeout, async () => {
    actual = await this.browser.getTextFromSelector('.govuk-header__service-name', tinyTimeout)

    return actual === string
  }, (reject) => {
    reject(new Error(`Gave up waiting for service name to become [${string}], it was [${actual}]`))
  })
})

Then('the service name in the GOV.UK header should become {string} on the URL {string}', standardTimeout, async function (headerText, url) {
  let actual = null
  await waitForConditionToBeMet(standardTimeout, async () => {
    await this.browser.openUrl(url)
    actual = await this.browser.getTextFromSelector('.govuk-header__service-name', tinyTimeout)

    return actual === headerText
  }, (reject) => {
    reject(new Error(`Gave up waiting for service name to become [${headerText}], it was [${actual}]`))
  })
})
