const { When, Then } = require('@cucumber/cucumber')
const { expect, mediumActionTimeout, standardTimeout, waitForConditionToBeMet } = require('./utils')
const { By } = require('selenium-webdriver')
const { sleep } = require('../../lib/utils')

async function getTemplateList (browser) {
  if (!(await browser.getCurrentUrl()).includes('/manage-prototype/templates')) {
    await browser.openUrl('/manage-prototype/templates')
  }
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
  let formInput, submitButton, h1
  await waitForConditionToBeMet(mediumActionTimeout, async () => {
    [formInput, submitButton, h1] = await Promise.all([
      browser.queryId('chosen-url'),
      browser.queryId('create-page-from-template'),
      browser.queryTag('h1').then(tags => tags[0])
    ])
    return formInput && submitButton && h1
  })
  ;(await expect(await h1.getText())).to.equal('Create new ' + createTemplateName)
  await formInput.sendKeys(newPageUrl)
  await submitButton.click()
})

When('I choose the {string} template from the {string} plugin', mediumActionTimeout, async function (createTemplateName, fromPluginName) {
  const browser = this.browser
  const requestedTemplateRow = await getTemplateInformation(browser, fromPluginName, createTemplateName, 3)
  await requestedTemplateRow.createButton.click()
})

async function expectH1ToBe (browser, headerText, timeout) {
  let h1Text = null
  await waitForConditionToBeMet(timeout, async () => {
    const h1 = (await browser.queryTag('h1'))[0]
    if (h1) {
      h1Text = await h1.getText()
      return h1Text.includes(headerText)
    }
    return false
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
  const link = await this.browser.queryId('view-page-link')
  await link.click()
})

Then('I should see the GOV.UK Header', standardTimeout, async function () {
  const classToLookFor = 'govuk-header__logo'
  await waitForConditionToBeMet(standardTimeout.timeout, async () => {
    const elems = await this.browser.queryClass(classToLookFor)
    if (elems.length === 0) {
      return false
    }
    return true
  }, () => {
    throw new Error(`Expected GOV.UK Header but couldn't find element with class [${classToLookFor}]`)
  })
})

Then('I should not see the GOV.UK Header', standardTimeout, async function () {
  const classToLookFor = 'govuk-header__logo'
  const elems = await this.browser.queryClass(classToLookFor)
  if (elems.length > 0) {
    throw new Error(`Expected no GOV.UK Header but there is an element with class [${classToLookFor}]`)
  }
})

Then('I should see the page header {string}', standardTimeout, async function (expectedHeader) {
  await expectH1ToBe(this.browser, expectedHeader, standardTimeout)
})
