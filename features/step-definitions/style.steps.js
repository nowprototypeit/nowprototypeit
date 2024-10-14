const { Then } = require('@cucumber/cucumber')
const {
  waitForConditionToBeMet,
  styleBuildTimeout,
  mediumActionTimeout,
  makeGetRequest,
  expect,
  standardTimeout
} = require('./utils')
const path = require('path')
const { promises: fsp } = require('fs')
const { sleep } = require('../../lib/utils')

Then('the body background color should become {string}', styleBuildTimeout, async function (expectedColor) {
  let style

  await waitForConditionToBeMet(styleBuildTimeout, async () => {
    style = await this.browser.driver.executeScript('return window.getComputedStyle(document.body).backgroundColor;')
    return style === expectedColor
  }, (reject) => {
    return reject(new Error(`Gave up waiting for background color [${style}] to become equal to [${expectedColor}]`))
  })
})

Then('the first paragraph margin top should become {string}', styleBuildTimeout, async function (expectedMarginTop) {
  let marginTop
  await waitForConditionToBeMet(styleBuildTimeout, async () => {
    const firstParagraph = (await this.browser.queryTag('p'))[0]
    if (!firstParagraph) {
      throw new Error('Could not find first paragraph')
    }
    try {
      marginTop = await firstParagraph.getCssValue('margin-top')
      return marginTop === expectedMarginTop
    } catch (e) {
      return false
    }
  }, (reject) => {
    return reject(new Error(`Gave up waiting for margin-top [${marginTop}] to become equal to [${expectedMarginTop}]`))
  })
})

Then('I should see the crown icon in the footer', mediumActionTimeout, async function () {
  await makeSureBackgroundImageCanBeLoaded(this.browser, this.kit.dir, mediumActionTimeout.timeout)
})

async function makeSureBackgroundImageCanBeLoaded (browser, prototypeDir, timeout) {
  const start = Date.now()
  let output = 'none'
  while (output === 'none' && (start + timeout) > Date.now()) {
    await sleep(100)
    const element = (await browser.queryClass('govuk-footer__copyright-logo'))[0]
    if (element) {
      output = await browser.driver.executeScript('const style = window.getComputedStyle(arguments[0]); return {backgroundImage: style.backgroundImage};', element)
    }
  }

  const [before, url, after] = output.backgroundImage.split('"')
  ;(await expect(before)).to.equal('url(')
  ;(await expect(after)).to.equal(')')
  const filePathFromNodeModules = url.split('plugin-assets/')[1]
  if (!filePathFromNodeModules) {
    throw new Error(`No file path could be found (looking for background image) [${output.backgroundImage}]`)
  }
  const filePath = path.join(prototypeDir, 'node_modules', filePathFromNodeModules)
  const fileOnFileSystem = await fsp.readFile(filePath, 'utf8')
  let lastKnownError
  await waitForConditionToBeMet(standardTimeout, async () => {
    const response = await makeGetRequest(url)
    const statusCode = response.statusCode
    const contentType = response.headers['content-type']
    if (statusCode !== 200) {
      lastKnownError = `Expected status code 200, got ${statusCode}`
      return false
    }
    if (contentType !== 'image/svg+xml; charset=utf-8') {
      lastKnownError = `Expected content type image/svg+xml, got ${contentType}`
      return false
    }
    if (response.body.toString() !== fileOnFileSystem) {
      console.log('response.body', response.body.toString())
      lastKnownError = 'Response body doesn\'t match file on file system'
      return false
    }
    return true
  }, () => {
    throw new Error(`Gave up waiting for background image meet conditions: ${lastKnownError}`)
  })
}
