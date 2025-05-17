const { chromium } = require('playwright')
const uuid = require('uuid')
const { standardTimeout } = require('./timeouts')
const { addShutdownFn } = require('../../../lib/utils/shutdownHandlers')
const { verboseLog } = require('../../../lib/utils/verboseLogger')

let singleSharedBrowser = null
async function getBrowser (config = {}) {
  if (singleSharedBrowser) {
    verboseLog('Reusing shared browser')
    return singleSharedBrowser
  }
  let baseUrl
  const browserPromise = chromium.launch({
    headless: process.env.SHOW_BROWSER !== 'true'
  })
  const pagePromise = browserPromise
    .then(browser => browser.newContext())
    .then(context => context.newPage())

  addShutdownFn(async () => {
    await browser.close()
  })

  async function getProcessedTemplateRows ($$templateList) {
    return await Promise.all($$templateList.map(async ($section) => {
      let pluginName = (await (await $section.$('.manage-prototype-template-plugin-name')).textContent())?.trim()
      const scope = (await (await $section.$('.plugin-scope'))?.textContent())?.trim()
      if (scope) {
        pluginName = [pluginName, scope].join(' ')
      }
      const $$templateRows = await $section.$$('.template-list__item')

      const templates = await Promise.all($$templateRows.map(async ($row) => {
        const name = (await (await $row.$('.plugin-templates-template-name')).textContent())?.trim()
        const viewButton = await $row.$('.template-list__item-link--view')
        const createButton = await $row.$('.template-list__item-link--create')
        return {
          name,
          viewButton,
          createButton
        }
      }))
      return {
        pluginName,
        templates
      }
    }))
  }

  async function getTemplateInfoForPluginAndTemplate (pluginName, templateName) {
    const currentUrl = new URL(self.getCurrentUrl()).pathname
    const expectedUrl = '/manage-prototype/templates'
    if (currentUrl !== expectedUrl) {
      throw new Error(`You must be on the template page before starting this, URL should be [${expectedUrl}] but was [${currentUrl}]`)
    }
    const $$templateList = await page.$$('.plugin-templates')
    const processedTemplateRows = await getProcessedTemplateRows($$templateList)
    const pluginTemplates = processedTemplateRows.find(({ pluginName: name }) => name === pluginName)
    if (!pluginTemplates) {
      throw new Error(`Couldn't find plugin templates for [${pluginName}], plugins were [${processedTemplateRows.map(({ pluginName }) => pluginName).join(', ')}]`)
    }
    const templateRow = pluginTemplates.templates.find(({ name }) => name === templateName)
    if (!templateRow) {
      throw new Error(`Couldn't find template [${templateName}] in plugin [${pluginName}], templates were [${pluginTemplates.templates.map(({ name }) => name).join(', ')}]`)
    }
    return templateRow
  }

  function replaceNonBreakingSpaces (text) {
    // the text doesn't contain &nbsp; but it does contain non-breaking spaces
    // so we need to replace them with normal spaces
    return text.replaceAll(/\u00A0/g, ' ')
  }

  const self = {
    id: uuid.v4(),
    setBaseUrl: (newBaseUrl) => {
      baseUrl = newBaseUrl
    },
    getFullUrl,
    openUrl: async (url, timeoutDeclaration = standardTimeout) => {
      await page.goto(getFullUrl(url), { timeout: timeoutDeclaration.timeout })
    },
    getCurrentUrl: () => {
      return page.url()
    },
    takeScreenshot: async (filePath) => {
      await page.screenshot({ path: filePath, fullPage: true })
    },
    refresh: async () => {
      await page.reload()
    },
    hasSelector: async (selector, timeout = standardTimeout) => {
      const element = await page.$(selector, { timeout: timeout.timeout })
      return !!element
    },
    getTextFromSelector: async (selector, timeoutDeclaration = standardTimeout) => {
      const text = (await page.textContent(selector, { timeout: timeoutDeclaration.timeout }))?.trim()
      return replaceNonBreakingSpaces(text)
    },
    getTextFromSelectorAll: async (selector, timeoutDeclaration = standardTimeout) => {
      const $$elems = await page.$$(selector)
      const elemContents = await Promise.all($$elems.map(async x => await x.textContent()))
      return elemContents.map(x => x?.trim())
    },
    getLinkTextAndUrlFromSelectorAll: async (selector, timeoutDeclaration = standardTimeout) => {
      const $$elems = await page.$$(selector)
      return await Promise.all($$elems.map(async x => ({
        text: (await x.textContent())?.trim(),
        url: await x.getAttribute('href')
      })))
    },
    getTitle: async () => {
      return await page.title()
    },
    clickId: async (id, timeoutDeclaration = standardTimeout) => {
      const element = await page.$(`#${id}`, { timeout: timeoutDeclaration.timeout })
      if (!element) {
        throw new Error(`Element with id ${id} not found`)
      }
      await element.click()
    },
    clickLinkWithText: async (text, timeoutDeclaration = standardTimeout) => {
      await self.clickLinkBySelector(`a:has-text("${text}")`, timeoutDeclaration)
    },
    clickLinkBySelector: async (selector, timeoutDeclaration = standardTimeout) => {
      const $$links = await page.$$(selector, { timeout: timeoutDeclaration.timeout })
      if ($$links.length !== 1) {
        throw new Error(`Expected one link from selector [${selector}], found [${$$links.length}]`)
      }
      await $$links[0].click()
    },
    clickButtonWithText: async (text, timeoutDeclaration = standardTimeout) => {
      const element = await page.$(`button:has-text("${text}")`, { timeout: timeoutDeclaration.timeout })
      if (!element) {
        throw new Error(`Button with text ${text} not found`)
      }
      await element.click()
    },
    clickButtonWithId: async (id, timeoutDeclaration = standardTimeout) => {
      const element = await page.$(`button#${id}`, { timeout: timeoutDeclaration.timeout })
      if (!element) {
        throw new Error(`Button with ID ${id} not found`)
      }
      await element.click()
    },
    fillFormFields: async (fields, timeoutDeclaration = standardTimeout) => {
      for (const [fieldName, value] of Object.entries(fields)) {
        const selector = `input[name=${fieldName}]`
        const element = await page.$(selector, { timeout: timeoutDeclaration.timeout })
        if (!element) {
          throw new Error(`Element with selector ${selector} not found`)
        }
        await element.fill(value)
      }
    },
    getClassArrayForElement: async (selector, timeoutDeclaration = standardTimeout) => {
      const element = await page.$(selector, { timeout: timeoutDeclaration.timeout })
      if (!element) {
        throw new Error(`Element with selector ${selector} not found`)
      }
      const className = await element.getAttribute('class')
      return className.split(' ')
    },
    getErrorDetailSummary: async (timeoutDeclaration = standardTimeout) => {
      const errorDetailsElems = await page.$$('.error-description', { timeout: timeoutDeclaration.timeout })
      const errorDetailsText = await Promise.all(errorDetailsElems.map(async (elem) => {
        return (await elem.evaluate(el => el.innerHTML)).trim()
      }))
      const errorDetails = {}
      errorDetailsText.forEach((errorDetail) => {
        const dt = errorDetail.match(/<dt>(.*?)<\/dt>/g)
        const dd = errorDetail.match(/<dd>(.*?)<\/dd>/g)
        if (dt && dd) {
          dt.forEach((item, index) => {
            const key = item.replace(/<\/?dt>/g, '').trim()
            errorDetails[key] = dd[index].replace(/<\/?dd>/g, '').trim()
          })
        }
      })
      return errorDetails
    },
    getSourceCodeLineNumbersFromErrorPage: async (timeoutDeclaration = standardTimeout) => {
      const $$errorDetails = await page.$$('.error-source-code__line-number', { timeout: timeoutDeclaration.timeout * 0.75 })
      return await Promise.all($$errorDetails.map(async (elem) => {
        return (await elem.evaluate(el => el.textContent)).trim()
      }))
    },
    getHighlightedNumbers: async (timeoutDeclaration = standardTimeout) => {
      const $$errorDetails = await page.$$('.error-source-code__line-number--highlighted', { timeout: timeoutDeclaration.timeout * 0.75 })
      return await Promise.all($$errorDetails.map(async (elem) => {
        return (await elem.evaluate(el => el.textContent)).trim()
      }))
    },
    getBodyBackgroundColor: async (timeoutDeclaration = standardTimeout) => {
      const getComputedStyle = (el) => ({ backgroundColor: 'fake-for-typing' })
      const $body = await page.$('body', { strict: true, timeout: timeoutDeclaration.timeout })
      if (!$body) {
        throw new Error('Body element not found')
      }
      return await $body.evaluate(el => getComputedStyle(el).backgroundColor)
    },
    getProgressBarValueAndMax: async (timeoutDeclaration = standardTimeout) => {
      const $progressBar = await page.$('.nowprototypeit-progress-bar', { strict: true, timeout: timeoutDeclaration.timeout })
      if (!$progressBar) {
        throw new Error('Progress bar element not found')
      }
      // get max and value attributes
      const max = await $progressBar.getAttribute('max')
      const value = await $progressBar.getAttribute('value')
      return {
        max,
        value
      }
    },
    clickCreateForTemplate: async (templateName, pluginName) => {
      const templateRow = await getTemplateInfoForPluginAndTemplate(pluginName, templateName)
      const createButton = templateRow.createButton
      if (!createButton) {
        throw new Error(`Couldn't find create button for template [${templateName}] in plugin [${pluginName}]`)
      }
      await createButton.click()
    },
    clickViewForTemplate: async (templateName, pluginName) => {
      const templateRow = await getTemplateInfoForPluginAndTemplate(pluginName, templateName)
      const viewButton = templateRow.viewButton
      if (!viewButton) {
        throw new Error(`Couldn't find create button for template [${templateName}] in plugin [${pluginName}]`)
      }
      await viewButton.click()
    },
    getPluginDetails: async (overallTimeoutDeclaration = standardTimeout) => {
      const $$pluginElements = await page.$$('.nowprototypeit-manage-prototype-plugin-list__item')

      return await Promise.all($$pluginElements.map(async ($elem) => {
        const name = (await (await $elem.$('.nowprototypeit-manage-prototype-plugin-list-plugin-name')).textContent()).trim()
        const tags = []
        let hasInstalledFlag = false
        if ((await $elem.$$('.nowprototypeit-manage-prototype-plugin-list-item-installed-details')).length > 0) {
          tags.push('Installed')
          hasInstalledFlag = true
        }
        return {
          name,
          tags,
          hasInstalledFlag
        }
      }))
    },
    selectRadioButtonById: async (id, timeoutDeclaration = standardTimeout) => {
      await self.selectRadioButtonBySelector(`#${id}`, timeoutDeclaration)
    },
    selectRadioButtonBySelector: async (selector, timeoutDeclaration = standardTimeout) => {
      const element = await page.$(selector, { timeout: timeoutDeclaration.timeout })
      if (!element) {
        throw new Error(`Element with selector [${selector}] not found`)
      }
      await element.check()
    },
    submitTheOnlyFormOnThePage: async (timeoutDeclaration = standardTimeout) => {
      const $$forms = await page.$$('form', { timeout: timeoutDeclaration.timeout })
      if ($$forms.length !== 1) {
        throw new Error(`Expected 1 form on the page, found [${$$forms.length}]`)
      }
      const $form = $$forms[0]
      const $submitButton = await $form.$('button[type="submit"]')
      if (!$submitButton) {
        throw new Error('Submit button not found')
      }
      await $submitButton.click()
    },
    submitFormBySelector: async (selector, timeoutDeclaration = standardTimeout) => {
      const $form = await page.$(selector, { timeout: timeoutDeclaration.timeout })
      if (!$form) {
        throw new Error(`Form with selector ${selector} not found`)
      }
      const $submitButton = await $form.$('button[type="submit"]')
      if (!$submitButton) {
        throw new Error('Submit button not found')
      }
      await $submitButton.click()
    },
    clickPluginSettingsForPluginName: async (pluginName) => {
      const $$subNavItems = await page.$$('.nowprototypeit-sub-nav-item')
      const linkInfo = await Promise.all($$subNavItems.map(async ($item) => {
        const $a = await $item.$('a')
        const $subtext = await $item.$('.nowprototypeit-sub-nav-item__subtext')
        if (!$a) {
          return {}
        }
        return {
          text: (await $a.textContent()).trim(),
          href: await $a.getAttribute('href'),
          subText: $subtext ? (await $subtext.textContent()).trim() : undefined,
          linkElement: $a
        }
      }))

      const link = linkInfo.find(({ text }) => text === pluginName)
      if (!link) {
        throw new Error(`Could not find link for ${pluginName}, links were [${linkInfo.map(({ text }) => text).join(', ')}]`)
      }
      await link.linkElement.click()
    },
    getMarginTopOfFirstParagraph: async (timeoutDeclaration = standardTimeout) => {
      const getComputedStyle = (el) => ({ marginTop: 'fake-for-typing' })
      const $firstParagraph = await page.$('p:first-of-type', { timeout: timeoutDeclaration.timeout })
      if (!$firstParagraph) {
        throw new Error('First paragraph not found')
      }
      return await $firstParagraph.evaluate(el => getComputedStyle(el).marginTop)
    },
    getMaskImageForBeforeOfSelector: async (selector, timeoutDeclaration = standardTimeout) => {
      const getComputedStyle = (el, pseudo) => ({ maskImage: 'fake-for-typing' })
      const $elem = await page.$(selector, { timeout: timeoutDeclaration.timeout })
      if (!$elem) {
        throw new Error(`Element with selector ${selector} not found`)
      }
      return await $elem.evaluate(el => getComputedStyle(el, 'before').maskImage)
    },
    setEditorContents: async (val, timeoutDeclaration = standardTimeout) => {
      await page.locator('.view-lines > div:nth-child(2)').click()
      await page.getByRole('textbox', { name: 'Editor content;Press Alt+F1' }).press('ControlOrMeta+a')
      await page.getByRole('textbox', { name: 'Editor content;Press Alt+F1' }).press('Delete')
      await page.getByRole('textbox', { name: 'Editor content;Press Alt+F1' }).fill(val)
    }
  }

  const browser = await browserPromise
  const page = await pagePromise
  singleSharedBrowser = self
  return self

  function getFullUrl (url) {
    return url.startsWith('/') && baseUrl ? baseUrl + url : url
  }
}

module.exports = {
  getBrowser
}
