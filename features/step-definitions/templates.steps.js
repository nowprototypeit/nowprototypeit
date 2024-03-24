const { When, Then } = require('@cucumber/cucumber')
const { expect, mediumActionTimeout } = require('./utils')
const { By } = require('selenium-webdriver')
const { sleep } = require('../../lib/utils')

async function getTemplateList (browser) {
  await browser.openUrl('/manage-prototype/templates')
  const pluginSections = await browser.queryClass('plugin-templates')
  return await Promise.all(pluginSections.map(async section => {
    const templateRows = await section.findElements(By.className('template-list__item'))
    const processedTemplateRows = await Promise.all(templateRows.map(async row => {
      return {
        name: await (await row.findElement(By.className('plugin-templates-template-name'))).getText(),
        viewButton: await row.findElement(By.className('template-list__item-link--view')),
        createButton: await row.findElement(By.className('template-list__item-link--create'))
      }
    }))

    async function getPluginName () {
      const pluginName = await (await section.findElement(By.className('manage-prototype-template-plugin-name'))).getText()
      const scopeElem = (await section.findElements(By.className('plugin-scope')))[0]
      if (scopeElem) {
        return [pluginName, await scopeElem.getText()].join(' ')
      }
      return pluginName
    }

    return {
      pluginName: await getPluginName(),
      templates: processedTemplateRows
    }
  }))
}

async function getTemplateInformation (browser, fromPluginName, templateName, maxRetries = 0, delayBetweenRetries = 300) {
  await sleep(2000)
  const templatesByPlugin = await getTemplateList(browser)
  const requestedPluginTemplates = templatesByPlugin.find(({ pluginName }) => pluginName === fromPluginName)
  if (!requestedPluginTemplates) {
    if (maxRetries > 0) {
      console.log('failed to get template [%s] from plugin [%s] because the plugin isn\'t installed.  Retrying up to [%s] more times.', templateName, fromPluginName, maxRetries)
      await sleep(delayBetweenRetries)
      return await getTemplateInformation(browser, fromPluginName, templateName, maxRetries - 1, delayBetweenRetries)
    }
    const templatePluginNames = templatesByPlugin.map(({ pluginName }) => pluginName).join(', ')
    throw new Error(`Couldn't find templates from plugin [${fromPluginName}], available options are [${templatePluginNames}]`)
  }
  const requestedTemplateRow = requestedPluginTemplates.templates.find(({ name }) => name === templateName)
  if (!requestedTemplateRow) {
    if (maxRetries > 0) {
      console.log('failed to get template [%s] from plugin [%s] because the template can\'t be found.  Retrying up to [%s] more times.', templateName, fromPluginName, maxRetries)
      await sleep(delayBetweenRetries)
      return await getTemplateInformation(browser, fromPluginName, templateName, maxRetries - 1, delayBetweenRetries)
    }
    throw new Error(`Couldn't find the template [${templateName}] from plugin [${fromPluginName}], available options are [${requestedPluginTemplates.templates.map(({ name }) => name)}]`)
  }
  return requestedTemplateRow
}

When('I preview the {string} template from the {string} plugin', mediumActionTimeout, async function (createTemplateName, fromPluginName) {
  const x = await getTemplateInformation(this.browser, fromPluginName, createTemplateName, 3)
  await x.viewButton.click()
})

When('I create a page at {string} using the {string} template from the {string} plugin', mediumActionTimeout, async function (newPageUrl, createTemplateName, fromPluginName) {
  const browser = this.browser
  const requestedTemplateRow = await getTemplateInformation(browser, fromPluginName, createTemplateName, 3)
  await requestedTemplateRow.createButton.click()
  const [formInput, submitButton, h1] = await Promise.all([
    browser.queryId('chosen-url'),
    browser.queryId('create-page-from-template'),
    browser.queryTag('h1')
  ])
  ;(await expect(await h1[0].getText())).to.equal('Create new ' + createTemplateName)
  await formInput.sendKeys(newPageUrl)
  await submitButton.click()
})

async function expectH1ToBe (browser, headerText) {
  const startDate = new Date()
  let h1
  while (!h1) {
    h1 = await browser.queryTag('h1')
    if (h1.length === 0) {
      if (new Date() - startDate > 2000) {
        throw new Error('Timed out waiting for h1 element to appear')
      }
      await sleep(100)
    }
  }
  const h1Text = await h1[0].getText()
  ;(await expect(h1Text)).to.contain(headerText)
}

Then('I should see a template creation success page', async function () {
  await expectH1ToBe(this.browser, 'Page created')
})

When('I click through to the page I created from a template', async function () {
  const link = await this.browser.queryId('view-page-link')
  await link.click()
})

Then('I should see the GOV.UK Header', async function () {
  const classToLookFor = 'govuk-header__logo'
  const elems = await this.browser.queryClass(classToLookFor)
  if (elems.length === 0) {
    throw new Error(`Expected GOV.UK Header but couldn't find element with class [${classToLookFor}]`)
  }
})

Then('I should see the page header {string}', async function (expectedHeader) {
  await expectH1ToBe(this.browser, expectedHeader)
})
