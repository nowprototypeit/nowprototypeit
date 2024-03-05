const { Then } = require('@cucumber/cucumber')
const { waitForConditionToBeMet, styleBuildTimeout } = require('./utils')

Then('the body background color should become {string}', styleBuildTimeout, async function (expectedColor) {
  let style

  await waitForConditionToBeMet(styleBuildTimeout, async () => {
    style = await this.browser.driver.executeScript('return window.getComputedStyle(document.body).backgroundColor;')
    return style === expectedColor
  }, (reject) => {
    return reject(new Error(`Gave up waiting for background color [${style}] to become equal to [${expectedColor}]`))
  })
})
