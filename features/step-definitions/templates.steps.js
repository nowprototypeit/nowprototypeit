const fsp = require('fs').promises
const { When, Then } = require('@cucumber/cucumber')
const { expect, makeGetRequest } = require('./utils')
const { By } = require('selenium-webdriver')
const mediumActionTimeout = require('./utils')
const path = require('path')

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

async function getTemplateInformation (browser, fromPluginName, createTemplateName) {
  const templatesByPlugin = await getTemplateList(browser)
  const requestedPluginTemplates = templatesByPlugin.find(({ pluginName }) => pluginName === fromPluginName)
  if (!requestedPluginTemplates) {
    const templatePluginNames = templatesByPlugin.map(({ pluginName }) => pluginName).join(', ')
    throw new Error(`Couldn't find templates from plugin [${fromPluginName}], available options are [${templatePluginNames}]`)
  }
  const requestedTemplateRow = requestedPluginTemplates.templates.find(({ name }) => name === createTemplateName)
  if (!requestedPluginTemplates) {
    const templateNames = requestedPluginTemplates.map(({ pluginName }) => pluginName).join(', ')
    throw new Error(`Couldn't find the template [${createTemplateName}] from plugin [${fromPluginName}], available options are [${templateNames}]`)
  }
  return requestedTemplateRow
}

When('I preview the {string} template from the {string} plugin', mediumActionTimeout, async function (createTemplateName, fromPluginName) {
  const x = await getTemplateInformation(this.browser, fromPluginName, createTemplateName)
  await x.viewButton.click()
})

When('I create a page at {string} using the {string} template from the {string} plugin', mediumActionTimeout, async function (newPageUrl, createTemplateName, fromPluginName) {
  const browser = this.browser
  const requestedTemplateRow = await getTemplateInformation(browser, fromPluginName, createTemplateName)
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
  const h1Text = await (await browser.queryTag('h1'))[0].getText()
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

async function makeSureBackgroundImageCanBeLoaded (browser, element, prototypeDir) {
  await browser.driver.executeScript('const style = window.getComputedStyle(arguments[0]); return {backgroundImage: style.backgroundImage};', element)
    .then(async function (output) {
      const [before, url, after] = output.backgroundImage.split('"')
      ;(await expect(before)).to.equal('url(')
      ;(await expect(after)).to.equal(')')
      const filePathFromNodeModules = url.split('plugin-assets/')[1]
      if (!filePathFromNodeModules) {
        throw new Error(`No file path could be found (looking for background image) [${output.backgroundImage}]`)
      }
      const filePath = path.join(prototypeDir, 'node_modules', filePathFromNodeModules)
      const fileOnFileSystem = await fsp.readFile(filePath)
      await makeGetRequest(url).then(async response => {
        ;(await expect(response.statusCode)).to.equal(200)
        ;(await expect(response.headers['content-type'])).to.equal('image/png')
        const comparison = Buffer.compare(response.body, fileOnFileSystem)
        if (comparison !== 0) {
          throw new Error(`Comparing file system to response failed [${comparison}]`)
        }
      }).catch(err => console.error(err))
    })
}

Then('I should see the crown icon in the footer', async function () {
  await makeSureBackgroundImageCanBeLoaded(this.browser, (await this.browser.queryClass('govuk-footer__copyright-logo'))[0], this.kit.dir)
})

Then('I should see the page header {string}', async function (expectedHeader) {
  await expectH1ToBe(this.browser, expectedHeader)
})
