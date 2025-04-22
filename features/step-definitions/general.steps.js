const { Given, Then, When } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { sleep } = require('../../lib/utils')
const { intentionalDelayTimeout, waitForConditionToBeMet, makeGetRequest, tinyTimeout } = require('./utils')
const path = require('node:path')
const fs = require('node:fs')
const { mediumActionTimeout, standardTimeout, readFixtureFile, writePrototypeFile } = require('./utils')
const { By } = require('selenium-webdriver')

const { promises: fsp } = fs
const kitVersion = require('../../package.json').version

Given('I do nothing', standardTimeout, function () {
})

Given('I wait for {int} seconds', intentionalDelayTimeout, async function (seconds) {
  const ms = seconds * 1000
  const maxMs = intentionalDelayTimeout.timeout - 300
  if (ms > maxMs) {
    throw new Error(`The requested timeout is too long, maximum is [${maxMs}], requested wsa [${ms}]`)
  }

  await sleep(ms)
})

Given('I refresh the browser', standardTimeout, async function () {
  await this.browser.refresh()
})

Then('the main heading should read {string}', standardTimeout, async function (expectedHeading) {
  const actualH1 = await (await this.browser.queryTag('h1'))[0]?.getText()
  ;(await expect(actualH1)).to.equal(expectedHeading)
})

Then('the page should include a paragraph that reads {string}', standardTimeout, async function (expectedHeading) {
  const allPText = await Promise.all((await this.browser.queryTag('p')).map(elem => elem.getText()))
  ;(await expect(allPText)).to.include(expectedHeading)
})

Then('the first paragraph should read {string}', standardTimeout, async function (expectedHeading) {
  const actualH1 = await (await this.browser.queryTag('p'))[0]?.getText()
  ;(await expect(actualH1)).to.equal(expectedHeading)
})

Then('the main heading should be updated to {string}', mediumActionTimeout, async function (expectedHeading) {
  let actualH1
  return waitForConditionToBeMet(mediumActionTimeout, async () => {
    try {
      actualH1 = await (await this.browser.queryTag('h1'))[0]?.getText()
    } catch (e) {
      actualH1 = undefined
    }
    return actualH1 === expectedHeading
  }, function (reject) {
    return reject(new Error(`Gave up waiting for heading [${actualH1}] to become equal to [${expectedHeading}]`))
  })
})

Then('the page title should read {string}', standardTimeout, async function (expectedTitle) {
  const actualH1 = await (await this.browser.getTitle())
  ;(await expect(actualH1)).to.equal(expectedTitle)
})

Then('the page title should become {string}', mediumActionTimeout, async function (expectedTitle) {
  let actualTitleText
  await waitForConditionToBeMet(mediumActionTimeout, async () => {
    actualTitleText = await this.browser.getTitle()
    return actualTitleText === expectedTitle
  }, () => {
    throw new Error(`Gave up waiting for title [${actualTitleText}] to become equal to [${expectedTitle}]`)
  })
})
const statusCodeCheck = async function (statusCode, url) {
  let latestStatusCode = 0
  await waitForConditionToBeMet({ timeout: standardTimeout.timeout * 0.9 }, async () => {
    const response = await makeGetRequest(this.browser.getFullUrl(url))
    latestStatusCode = response.statusCode
    if (latestStatusCode === statusCode) {
      await this.browser.openUrl(url)
      return true
    }
    return false
  }, async () => {
    throw new Error(`Gave up waiting for status code [${latestStatusCode}] to become equal to [${statusCode}] for URL [${url}]`)
  })
}
Given('I am viewing a {int} page at {string}', standardTimeout, statusCodeCheck)
Then('I should receive a {int} for page at {string}', standardTimeout, statusCodeCheck)

When('I visit {string}', standardTimeout, async function (url) {
  await this.browser.openUrl(url)
})

When('I wait for the prototype to reload', mediumActionTimeout, async function () {
  await new Promise((resolve) => {
    this.kit.addNextKitRestartListener(() => {
      resolve()
    })
  })
})

When('I delete the file {string}', standardTimeout, async function (relativeFilePath) {
  const filePath = path.join(this.kit.dir, relativeFilePath)
  await fsp.rm(filePath)
})

When('I create a file {string} based on the fixture file {string}', standardTimeout, async function (relativeFilePath, fixtureFilePath) {
  await writePrototypeFile(this.kit, relativeFilePath, await readFixtureFile(fixtureFilePath))
})

When('I replace the file {string} based on the fixture file {string}', standardTimeout, async function (relativeFilePath, fixtureFilePath) {
  await writePrototypeFile(this.kit, relativeFilePath, await readFixtureFile(fixtureFilePath))
})

When('I append the file {string} with contents {string}', standardTimeout, async function (relativeFilePath, appendContent) {
  await fsp.appendFile(path.join(this.kit.dir, relativeFilePath), '\n' + appendContent + '\n')
})

When('I create a file {string} with contents {string}', standardTimeout, async function (relativeFilePath, fileContents) {
  await writePrototypeFile(this.kit, relativeFilePath, fileContents)
})

When('I update the file {string} with contents {string}', standardTimeout, async function (relativeFilePath, fileContents) {
  await writePrototypeFile(this.kit, relativeFilePath, fileContents)
})

When('I replace {string} with {string} in the file {string}', standardTimeout, async function (find, replace, file) {
  const filePath = path.join(this.kit.dir, file)
  const fileContents = await fsp.readFile(filePath, 'utf8')
  await fsp.writeFile(filePath, fileContents.replace(find, replace), 'utf8')
})

Then('there should be an {string} element with the text {string}', standardTimeout, async function (selector, expectedText) {
  const allElemsWithRequestedTag = await this.browser.queryTag(selector)
  const allElemsText = await Promise.all(allElemsWithRequestedTag.map(async (elem) => await elem.getText()))
  try {
    ;(await expect(allElemsText)).to.contain(expectedText)
  } catch (e) {
    console.error('All elements with requested tag:', allElemsText)
    throw e
  }
})

Then('the file {string} should contain {string}', standardTimeout, async function (relativeFilePath, expectedString) {
  const fileContents = await fsp.readFile(path.join(this.kit.dir, relativeFilePath), 'utf8')
  const expectedStringAfterReplacement = expectedString.replaceAll('(kit_version)', kitVersion)
  ;(await expect(fileContents)).to.include(expectedStringAfterReplacement)
})

Then('I should have the {string} plugin installed properly', standardTimeout, async function (pluginName) {
  const packageJson = JSON.parse(await fsp.readFile(path.join(this.kit.dir, 'package.json'), 'utf8'))
  ;(await expect(Object.keys(packageJson.dependencies))).to.contain(pluginName)
  const modulePath = path.join(this.kit.dir, 'node_modules', pluginName)
  const exists = fs.existsSync(modulePath)
  if (!exists) {
    throw new Error(`Plugin not installed properly - ${modulePath} does not exist`)
  }
})

When('I enter {string} into the {string} field', tinyTimeout, async function (value, fieldName) {
  const input = (await this.browser.queryCss(`input[name="${fieldName}"]`))[0]
  if (!input) {
    throw new Error(`Could not find input with name [${fieldName}]`)
  }
  await input.clear()
  await input.sendKeys(value)
})

async function submitForm (form) {
  const submitButtons = await form.findElements(By.css('button[type="submit"], input[type="submit"]'))
  if (submitButtons.length !== 1) {
    throw new Error(`Expected exactly one submit button in the form, found [${submitButtons.length}]`)
  }
  await submitButtons[0].click()
}

When('I submit the form', standardTimeout, async function () {
  let lastKnownError
  await waitForConditionToBeMet(standardTimeout, async () => {
    const forms = await this.browser.queryTag('form')
    const numberOfForms = forms.length
    if (numberOfForms !== 1) {
      lastKnownError = `Expected exactly one form on the page, found [${numberOfForms}]`
      return false
    }
    try {
      await submitForm(forms[0])
    } catch (e) {
      lastKnownError = e.message
      return false
    }
    return true
  }, () => {
    throw new Error(lastKnownError || 'Failed to submit form (for an unknown reason')
  })
})

When('I submit the form with ID {string}', standardTimeout, async function (formId) {
  const form = await this.browser.queryId(formId)
  if (!form) {
    throw new Error(`Failed to find form with ID [${formId}]`)
  }
  await submitForm(form)
})

When('I select the {string} radio button', standardTimeout, async function (radioElementId) {
  let lastKnownError = 'Failed to select radio button'
  await waitForConditionToBeMet(standardTimeout, async () => {
    const $elem = await this.browser.queryId(radioElementId)
    if (!$elem) {
      lastKnownError = `no element with ID ${radioElementId}`
      return false
    }
    if (!await $elem.isSelected()) {
      await $elem.click()
    }
    await sleep(100)
    return await $elem.isSelected()
  }, () => {
    throw new Error(lastKnownError)
  })
})

When('I click the link with text {string}', standardTimeout, async function (linkText) {
  const $links = await this.browser.queryTag('a')
  const $matchingLinks = (await Promise.all($links.map(async ($link) => (await $link.getText()) === linkText ? $link : undefined)))
    .filter(x => !!x)
  if ($matchingLinks.length === 0) {
    throw new Error(`Could not find link with text [${linkText}]`)
  }
  if ($matchingLinks.length > 1) {
    throw new Error(`Found ${$matchingLinks.length} links with text [${linkText}]`)
  }
  await $matchingLinks[0].click()
})

When('I log the page URL', standardTimeout, async function () {
  console.log(await this.browser.getCurrentUrl())
})

Then('the list with ID {string} should contain an item which starts with text {string}', standardTimeout, async function (id, text) {
  const $list = await this.browser.queryId(id)
  if (!$list) {
    throw new Error(`no element with ID ${id}`)
  }
  const $items = await $list.findElements(By.css('li'))
  if ($items.length === 0) {
    throw new Error(`no list items found in list with ID ${id}`)
  }
  const itemTexts = await Promise.all($items.map(async ($item) => await $item.getText()))
  const matchingItems = itemTexts.filter(x => x.startsWith(text))
  if (matchingItems.length === 0) {
    throw new Error(`no list items found in list with ID ${id} starting with text ${text}, found items: ${itemTexts.join(', ')}`)
  }
})

Then('the list with ID {string} should be empty', standardTimeout, async function (id, text) {
  const $list = await this.browser.queryId(id)
  if (!$list) {
    throw new Error(`no element with ID ${id}`)
  }
  const $items = await $list.findElements(By.css('li'))
  if ($items.length !== 0) {
    const itemTexts = await Promise.all($items.map(async ($item) => await $item.getText()))
    throw new Error(`Expected an empty list but the list contents was [${itemTexts.join(', ')}]`)
  }
  const itemTexts = await Promise.all($items.map(async ($item) => await $item.getText()))
  ;(await expect(itemTexts)).to.include(text)
})

When('I restart my prototype by updating the file {string}', { timeout: 30 * 1000 }, async function (relativeFilePath) {
  const currentUrl = await this.browser.getCurrentUrl()
  await this.browser.openUrl('about:blank')
  const restartedPromise = new Promise(resolve => {
    this.kit.addNextKitRestartListener(() => {
      resolve()
    })
  })
  await fsp.appendFile(path.join(this.kit.dir, relativeFilePath), '\n')
  console.log('appended file')
  await restartedPromise
  console.log('kit restarted')
  await this.browser.openUrl(currentUrl)
  console.log('url opened')
})

Then('I intentionally fail the tests', function () {
  throw new Error('Intentional failure')
})
