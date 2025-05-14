const { Then } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { standardTimeout, kitStartTimeout } = require('./setup-helpers/timeouts')

Then('I should see an error page', standardTimeout, async function () {
  let classArray
  const startTime = Date.now()
  let lastRunError = null
  while (classArray === undefined) {
    if (Date.now() - startTime > 2000) {
      if (lastRunError) {
        throw lastRunError
      }
      throw new Error('Timed out waiting for the error page to load')
    }
    lastRunError = null
    try {
      classArray = await this.browser.getClassArrayForElement('body')
    } catch (e) {
      lastRunError = e
    }
  }
  ;(await expect(classArray)).to.include('nowprototypeit-error-page')
})

Then('the error details should contain additional information starting with {string}', kitStartTimeout, async function (startOfAdditionalInfo) {
  const info = await this.browser.getErrorDetailSummary(standardTimeout)

  const additionalDetails = info['Additional information:']

  ;(await expect(additionalDetails.split(':')[0].trim() + ':')).to.eq(startOfAdditionalInfo)
})

Then('the error details should contain {string} {string}', kitStartTimeout, async function (name, value) {
  const info = await this.browser.getErrorDetailSummary(standardTimeout)

  function standardiseFilePath (path) {
    return path.split('\\').join('/')
  }

  ;(await expect(Object.keys(info))).to.contain(name)
  if (name === 'File path:') {
    ;(await expect(standardiseFilePath(info[name]))).to.eq(standardiseFilePath(value))
  } else {
    ;(await expect(info[name])).to.eq(value)
  }
})

async function assertLineNumber (browser, elemNumber, expectedFirstLineNumber) {
  const allLineNumberElems = await browser.getSourceCodeLineNumbersFromErrorPage()
;
  (await expect(await allLineNumberElems.at(elemNumber))).to.eq(expectedFirstLineNumber + '.')
}

Then('the source code should start at line {int}', standardTimeout, async function (expectedFirstLineNumber) {
  await assertLineNumber(this.browser, 0, expectedFirstLineNumber)
})

Then('the source code should end at line {int}', standardTimeout, async function (expectedLastLineNumber) {
  await assertLineNumber(this.browser, -1, expectedLastLineNumber)
})

Then('only lines {int}-{int} should be highlighted', standardTimeout, async function (expectedStartOfHighlight, expectedEndOfHighlight) {
  const highlightedNumbers = await this.browser.getHighlightedNumbers(standardTimeout)

  const expected = []

  for (let i = expectedStartOfHighlight; i <= expectedEndOfHighlight; i++) {
    expected.push(i.toString())
  }

  ;(await expect(highlightedNumbers)).to.have.all.members(expected)
})

Then('only line {int} should be highlighted', standardTimeout, async function (expectedLineNumber) {
  (await expect(await this.browser.getHighlightedNumbers(standardTimeout))).to.eql([expectedLineNumber + '.'])
})
