const { Then } = require('@cucumber/cucumber')
const { waitForConditionToBeMet, styleBuildTimeout, mediumActionTimeout, makeGetRequest, expect } = require('./utils')
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
    marginTop = await firstParagraph.getCssValue('margin-top')
    return marginTop === expectedMarginTop
  }, (reject) => {
    return reject(new Error(`Gave up waiting for margin-top [${marginTop}] to become equal to [${expectedMarginTop}]`))
  })
})

Then('I should see the crown icon in the footer', mediumActionTimeout, async function () {
  await makeSureBackgroundImageCanBeLoaded(this.browser, (await this.browser.queryClass('govuk-footer__copyright-logo'))[0], this.kit.dir, mediumActionTimeout.timeout)
})

async function makeSureBackgroundImageCanBeLoaded (browser, element, prototypeDir, timeout) {
  const start = Date.now()
  let output = 'none'
  while (output === 'none' && (start + timeout) > Date.now()) {
    await sleep(100)
    output = await browser.driver.executeScript('const style = window.getComputedStyle(arguments[0]); return {backgroundImage: style.backgroundImage};', element)
  }

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
}
