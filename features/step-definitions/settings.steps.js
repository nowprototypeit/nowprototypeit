const { Given, When, Then } = require('@cucumber/cucumber')
const { By } = require('selenium-webdriver')
const { expect, standardTimeout } = require('./utils')
const { mediumActionTimeout } = require('./utils')
const { sleep } = require('../../lib/utils')

Given('I am on the plugin settings page for the {string} plugin', standardTimeout, async function (pluginName) {
  await this.browser.openUrl('/manage-prototype/settings')
  const subNavItems = await this.browser.queryClass('nowprototypeit-sub-nav-item')
  const links = await Promise.all(subNavItems.map(async (item) => {
    const $a = (await item.findElements(By.tagName('a')))[0]
    const $subtext = (await item.findElements(By.className('nowprototypeit-sub-nav-item__subtext')))[0]
    if (!$a) {
      return {}
    }
    return {
      text: await $a.getText(),
      href: await $a.getAttribute('href'),
      subText: $subtext ? await $subtext.getText() : undefined,
      linkElement: $a
    }
  }))

  const link = links.find(({ text }) => text === pluginName)
  if (!link) {
    throw new Error(`Could not find link for ${pluginName}`)
  }
  await link.linkElement.click()
})

When('I fill in {string} with {string}', standardTimeout, async function (fieldId, value) {
  const field = await this.browser.queryId(fieldId)
  await field.sendKeys(value)
})

async function findFieldByNameAndValue (browser, fieldName, fieldValue) {
  let fields = []
  const start = Date.now()
  do {
    await sleep(100)
    await browser.refresh()
    fields = await Promise.all((await browser.queryAttribute('name', fieldName)).map(async (field) => {
      return {
        value: await field.getAttribute('value'),
        field
      }
    }))
  } while (fields.length === 0 && Date.now() - start < (mediumActionTimeout.timeout - 600))
  return fields.find(({ value }) => value === fieldValue)
}

When('I turn off the {string} setting', mediumActionTimeout, async function (fieldName) {
  const browser = this.browser
  const chosenField = await findFieldByNameAndValue(browser, fieldName, 'false')
  if (!chosenField) {
    throw new Error(`Could not find field with name ${fieldName} and value false`)
  }
  await chosenField.field.click()
})

When('I press {string}', standardTimeout, async function (buttonText) {
  const buttons = await Promise.all((await this.browser.queryTag('button')).map(async (button) => {
    return {
      text: await button.getText(),
      element: button
    }
  }))
  const button = buttons.find(({ text }) => text === buttonText)
  if (!button) {
    throw new Error(`Could not find button with text ${buttonText}`)
  }
  await button.element.click()
})

Then('I should see the settings saved message', standardTimeout, async function () {
  const toast = (await this.browser.queryClass('nowprototypeit-toast'))[0]
  if (!toast) {
    throw new Error('Could not find toast')
  }
  const toastText = await toast.getText()
  ;(await expect(toastText)).to.contain('Settings saved')
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
