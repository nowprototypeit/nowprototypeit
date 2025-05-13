const { Then } = require('@cucumber/cucumber')
const {
  waitForConditionToBeMet,
  makeGetRequest,
  expect
} = require('./utils')
const path = require('path')
const { promises: fsp } = require('fs')
const { sleep } = require('../../lib/utils')
const { styleBuildTimeout, standardTimeout, mediumActionTimeout } = require('./setup-helpers/timeouts')

Then('the body background color should become {string}', styleBuildTimeout, async function (expectedColor) {
  let style
  await waitForConditionToBeMet(styleBuildTimeout, async () => {
    const url = await this.browser.getCurrentUrl()
    if (url === 'chrome-error://chromewebdata/') {
      console.error(`The page URL is [${url}], this is usually caused by "request headers already sent" which doesn't have a helpful stack trace.  To investigate remove this protection and re-run a the "Regenerate styles, then reload page" test 100 times.`)
      await this.browser.refresh()
    }
    style = await this.browser.getBodyBackgroundColor()
    return style === expectedColor
  }, async (reject) => {
    return reject(new Error(`Gave up waiting for background color [${style}] to become equal to [${expectedColor}] on URL ${await this.browser.getCurrentUrl()}`))
  })
})

Then('the first paragraph margin top should become {string}', styleBuildTimeout, async function (expectedMarginTop) {
  let marginTop
  await waitForConditionToBeMet(styleBuildTimeout, async () => {
    try {
      marginTop = await this.browser.getMarginTopOfFirstParagraph(styleBuildTimeout)
      return marginTop === expectedMarginTop
    } catch (e) {
      return false
    }
  }, (reject) => {
    return reject(new Error(`Gave up waiting for margin-top [${marginTop}] to become equal to [${expectedMarginTop}]`))
  })
})

Then('I should see the crown icon in the footer', mediumActionTimeout, async function () {
  await makeSureMaskImageCanBeLoaded(this.browser, this.kit.dir, mediumActionTimeout.timeout)
})

async function makeSureMaskImageCanBeLoaded (browser, prototypeDir, timeout) {
  const start = Date.now()
  let output = 'none'
  while ((output === 'none' || output === null) && (start + (timeout / 2)) > Date.now()) {
    await sleep(100)
    try {
      output = await browser.getMaskImageForBeforeOfSelector('.govuk-footer__copyright-logo')
    } catch (e) {
      console.log('Error getting mask image', e)
    }
    if (!output) {
      await sleep(100)
    }
  }

  const [before, url, after] = output.split('"')
  ;(await expect(before)).to.equal('url(')
  ;(await expect(after)).to.equal(')')
  const filePathFromNodeModules = url.split('plugin-assets/')[1]
  if (!filePathFromNodeModules) {
    throw new Error(`No file path could be found (looking for mask image) [${output}]`)
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
