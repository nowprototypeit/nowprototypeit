const { Given, Then, When } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { sleep } = require('../../lib/utils')
const { intentionalDelayTimeout, pageRefreshTimeout, waitForConditionToBeMet, makeGetRequest } = require('./utils')
const path = require('node:path')
const fs = require('node:fs')
const { mediumActionTimeout, standardTimeout } = require('./utils')
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

Then('the main heading should be updated to {string}', pageRefreshTimeout, async function (expectedHeading) {
  let actualH1
  const isCorrect = async () => {
    try {
      actualH1 = await (await this.browser.queryTag('h1'))[0]?.getText()
    } catch (e) {
      actualH1 = undefined
    }
    return actualH1 === expectedHeading
  }

  function errorCallback (reject) {
    return reject(new Error(`Gave up waiting for heading [${actualH1}] to become equal to [${expectedHeading}]`))
  }

  return waitForConditionToBeMet(pageRefreshTimeout, isCorrect, errorCallback)
})

Then('the page title should read {string}', standardTimeout, async function (expectedTitle) {
  const actualH1 = await (await this.browser.getTitle())
  ;(await expect(actualH1)).to.equal(expectedTitle)
})

Then('the page title should become {string}', mediumActionTimeout, async function (expectedTitle) {
  const start = Date.now()
  let actualTitleText
  while (actualTitleText !== expectedTitle) {
    if (Date.now() - start > (mediumActionTimeout.timeout - 600)) {
      throw new Error(`Gave up waiting for title [${actualTitleText}] to become equal to [${expectedTitle}]`)
    }
    await sleep(100)
    actualTitleText = await this.browser.getTitle()
  }
})
Given('I am viewing a {int} page at {string}', standardTimeout, async function (statusCode, url) {
  const [response] = await Promise.all([
    makeGetRequest(this.browser.getFullUrl(url)),
    this.browser.openUrl(url)
  ])
  ;(await expect(response.statusCode)).to.equal(statusCode)
})

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

async function readFixtureFile (relativeFilePath, fileContents) {
  const filePath = path.join(__dirname, '..', 'fixtures', relativeFilePath)
  return await fsp.readFile(filePath, 'utf8')
}

async function writePrototypeFile (kit, relativeFilePath, fileContents) {
  const filePath = path.join(kit.dir, relativeFilePath)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, fileContents, 'utf8')
}
