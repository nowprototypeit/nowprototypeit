const { Given, Then, When } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { sleep } = require('../../lib/utils')
const { waitForConditionToBeMet, makeGetRequest } = require('./utils')
const path = require('node:path')
const fs = require('node:fs')
const { readFixtureFile, writePrototypeFile } = require('./utils')
const { By } = require('selenium-webdriver')
const { verboseLog } = require('../../lib/utils/verboseLogger')
const { standardTimeout, mediumActionTimeout, intentionalDelayTimeout, tinyTimeout, pluginActionTimeout } = require('./setup-helpers/timeouts')
const { exec } = require('../../lib/exec')

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
  const actualH1 = await this.browser.getTextFromSelector('h1:visible')
  ;(await expect(actualH1)).to.equal(expectedHeading)
})

Then('the page should include a paragraph that reads {string}', standardTimeout, async function (expectedHeading) {
  await waitForConditionToBeMet(standardTimeout, async () => {
    const allPText = (await this.browser.getTextFromSelectorAll('p')).map(standardSpaces)
    if (!allPText.includes(expectedHeading)) {
      throw new Error(`Expected to find paragraph with text [${expectedHeading}] but found [${allPText.join(', ')}]`)
    }
    return true
  })
  function standardSpaces (text) {
    return text.replace(/\s+/g, ' ').trim()
  }
})

Then('the first paragraph should read {string}', standardTimeout, async function (expectedHeading) {
  const actualH1 = await (await this.browser.queryTag('p'))[0]?.getText()
  ;(await expect(actualH1)).to.equal(expectedHeading)
})

Then('the main heading should be updated to {string}', mediumActionTimeout, async function (expectedHeading) {
  let actualH1
  return waitForConditionToBeMet(mediumActionTimeout, async () => {
    actualH1 = await (await this.browser.getTextFromSelector('h1:visible'))
    verboseLog('Waiting for h1 [%s] to be [%s]}:', actualH1, expectedHeading)
    return actualH1 === expectedHeading
  }, function (reject) {
    verboseLog('Gave up waiting for h1 [%s] to be [%s]}:', actualH1, expectedHeading)
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
  }, (reject) => {
    reject(new Error(`Gave up waiting for status code [${latestStatusCode}] to become equal to [${statusCode}] for URL [${url}]`))
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
  await this.browser.fillFormFields({
    [fieldName]: value
  })
})

When('I submit the form', standardTimeout, async function () {
  await this.browser.submitTheOnlyFormOnThePage(standardTimeout)
})

When('I submit the form with ID {string}', standardTimeout, async function (formId) {
  await this.browser.submitFormBySelector(`#${formId}`, standardTimeout)
})

When('I select the {string} checkbox', standardTimeout, async function (checkboxElementId) {
  await this.browser.selectCheckboxById(checkboxElementId)
})

When('I select the {string} radio button', standardTimeout, async function (radioElementId) {
  await this.browser.selectRadioButtonById(radioElementId)
})

When('I click the link with text {string}', standardTimeout, async function (linkText) {
  await this.browser.clickLinkWithText(linkText)
})
When('I click the button with text {string}', standardTimeout, async function (buttonText) {
  await this.browser.clickButtonWithText(buttonText)
})

When('I log the page URL', standardTimeout, async function () {
  console.log(await this.browser.getCurrentUrl())
})

Then('the list with ID {string} should contain an item which starts with text {string}', standardTimeout, async function (id, text) {
  const itemTexts = await this.browser.getTextFromSelectorAll(`#${id} > *`)

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
Given('I fully restart my prototype', standardTimeout, function () {
  return this.kit.restart()
})

Then('the page should contain bold text saying {string}', standardTimeout, async function (boldTextContent) {
  const boldText = await this.browser.getTextFromSelectorAll('strong')
  if (!boldText.includes(boldTextContent)) {
    throw new Error(`Expected bold text to contain [${boldTextContent}], but found [${boldText.join(', ')}]`)
  }
})

Then('the page should contain italic text saying {string}', standardTimeout, async function (boldTextContent) {
  const boldText = await this.browser.getTextFromSelectorAll('em')
  if (!boldText.includes(boldTextContent)) {
    throw new Error(`Expected bold text to contain [${boldTextContent}], but found [${boldText.join(', ')}]`)
  }
})

Then('the page should contain a link with URL and text of {string}', standardTimeout, async function (linkTextAndUrl) {
  const linkTextAndUrlList = await this.browser.getLinkTextAndUrlFromSelectorAll('a')
  const index = linkTextAndUrlList.findIndex(x => x.text === linkTextAndUrl)
  if (index === -1) {
    throw new Error(`Expected link to contain [${linkTextAndUrl}], but found [${linkTextAndUrlList.map(x => x.text).join(', ')}]`)
  }
  const found = linkTextAndUrlList[index]
  if (found.text !== found.url) {
    throw new Error(`Expected link text to be the same as the URL, but found text [${found.text}] and url [${found.url}]`)
  }
})

When('I clear my session data', standardTimeout, async function () {
  await this.browser.openUrl('/manage-prototype/clear-data')
  await this.browser.clickButtonWithText('Clear session data')
})

When('I install the npm dependency {string} using the command line', pluginActionTimeout, async function (dependencyName) {
  await exec(`npm install ${dependencyName}`, { cwd: this.kit.dir })
})
