const { Given, Then, When } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { sleep } = require('../../lib/utils')
const { intentionalDelayTimeout, pageRefreshTimeout, waitForConditionToBeMet, makeGetRequest } = require('./utils')
const path = require('node:path')
const { promises: fsp } = require('node:fs')

Given('I do nothing', function () {
})

Given('I wait for {int} seconds', intentionalDelayTimeout, async function (seconds) {
  const ms = seconds * 1000
  const maxMs = intentionalDelayTimeout.timeout - 300
  if (ms > maxMs) {
    throw new Error(`The requested timeout is too long, maximum is [${maxMs}], requested wsa [${ms}]`)
  }
  await sleep(ms)
})

Given('I refresh the browser', async function () {
  await this.browser.refresh()
})

Then('the main heading should read {string}', async function (expectedHeading) {
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

Then('the page title should read {string}', async function (expectedTitle) {
  const actualH1 = await (await this.browser.getTitle())
  ;(await expect(actualH1)).to.equal(expectedTitle)
})
Given('I am viewing a {int} page at {string}', async function (statusCode, url) {
  const [response] = await Promise.all([
    makeGetRequest(this.browser.getFullUrl(url)),
    this.browser.openUrl(url)
  ])
  ;(await expect(response.statusCode)).to.equal(statusCode)
})

When('I visit {string}', async function (url) {
  await this.browser.openUrl(url)
})

When('I delete the file {string}', async function (relativeFilePath) {
  const filePath = path.join(this.kit.dir, relativeFilePath)
  await fsp.rm(filePath)
})

When('I create a file {string} based on the fixture file {string}', async function (relativeFilePath, fixtureFilePath) {
  await writePrototypeFile(this.kit, relativeFilePath, await readFixtureFile(fixtureFilePath))
})

When('I append the file {string} with contents {string}', async function (relativeFilePath, appendContent) {
  await fsp.appendFile(path.join(this.kit.dir, relativeFilePath), '\n' + appendContent + '\n')
})

When('I create a file {string} with contents {string}', async function (relativeFilePath, fileContents) {
  await writePrototypeFile(this.kit, relativeFilePath, fileContents)
})

When('I update the file {string} with contents {string}', async function (relativeFilePath, fileContents) {
  await writePrototypeFile(this.kit, relativeFilePath, fileContents)
})

When('I replace {string} with {string} in the file {string}', async function (find, replace, file) {
  const filePath = path.join(this.kit.dir, file)
  const fileContents = await fsp.readFile(filePath, 'utf8')
  await fsp.writeFile(filePath, fileContents.replace(find, replace), 'utf8')
})

Then('there should be an {string} element with the text {string}', async function (selector, expectedText) {
  const allElemsWithRequestedTag = await this.browser.queryTag(selector)
  const allElemsText = await Promise.all(allElemsWithRequestedTag.map(async (elem) => await elem.getText()))
  try {
    ;(await expect(allElemsText)).to.contain(expectedText)
  } catch (e) {
    console.error('All elements with requested tag:', allElemsText)
    throw e
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
