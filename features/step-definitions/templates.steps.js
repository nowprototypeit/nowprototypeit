const { When, Then } = require('@cucumber/cucumber')
const { waitForConditionToBeMet } = require('./utils')
const { mediumActionTimeout, standardTimeout, tinyTimeout } = require('./setup-helpers/timeouts')

When('I preview the {string} template from the {string} plugin', mediumActionTimeout, async function (createTemplateName, fromPluginName) {
  await this.browser.openUrl('/manage-prototype/templates')
  await this.browser.clickViewForTemplate(createTemplateName, fromPluginName)
})

When('I create a page at {string} using the {string} template from the {string} plugin', mediumActionTimeout, async function (newPageUrl, createTemplateName, fromPluginName) {
  const browser = this.browser
  await browser.openUrl('/manage-prototype/templates')
  await browser.clickCreateForTemplate(createTemplateName, fromPluginName)
  await browser.fillFormFields({
    'chosen-url': newPageUrl
  })
  await browser.clickButtonWithText('Create page')
  const expectedH1 = 'Page created'
  let latestH1 = null
  await waitForConditionToBeMet(mediumActionTimeout, async () => {
    const actualH1 = await browser.getTextFromSelector('h1')
    if (actualH1) {
      latestH1 = actualH1
    }
    return latestH1 === expectedH1
  }, (reject) => {
    reject(new Error(`Expected h1 to contain [${expectedH1}] but found [${latestH1}]`))
  })
})

When('I choose the {string} template from the {string} plugin', mediumActionTimeout, async function (createTemplateName, fromPluginName) {
  await this.browser.clickCreateForTemplate(createTemplateName, fromPluginName)
})

async function expectH1ToBe (browser, headerText, timeout) {
  let h1Text = null
  await waitForConditionToBeMet(timeout, async () => {
    h1Text = await browser.getTextFromSelector('h1', tinyTimeout)
    return h1Text.includes(headerText)
  }, () => {
    if (!h1Text) {
      throw new Error('h1 never appeared on the page')
    }
    throw new Error(`Expected h1 to contain [${headerText}] but found [${h1Text}]`)
  })
}

Then('I should see a template creation success page', standardTimeout, async function () {
  await expectH1ToBe(this.browser, 'Page created', standardTimeout)
})

When('I click through to the page I created from a template', standardTimeout, async function () {
  await this.browser.clickLinkBySelector('#view-page-link')
})

Then('I should see the GOV.UK Header', standardTimeout, async function () {
  const selectorToLookFor = '.govuk-header__logo'
  await waitForConditionToBeMet(standardTimeout.timeout, async () => {
    return await this.browser.hasSelector(selectorToLookFor, tinyTimeout)
  }, () => {
    throw new Error(`Expected GOV.UK Header but couldn't find element with class [${selectorToLookFor}]`)
  })
})

Then('I should not see the GOV.UK Header', standardTimeout, async function () {
  const classToLookFor = 'govuk-header__logo'
  const elemExists = await this.browser.hasSelector('.' + classToLookFor, tinyTimeout)
  if (elemExists) {
    throw new Error(`Expected no GOV.UK Header but there is an element with class [${classToLookFor}]`)
  }
})

Then('I should see the page header {string}', standardTimeout, async function (expectedHeader) {
  await expectH1ToBe(this.browser, expectedHeader, standardTimeout)
})
