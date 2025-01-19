const { Then } = require('@cucumber/cucumber')
const { expect, standardTimeout } = require('./utils')
const { By } = require('selenium-webdriver')
const path = require('path')

Then('I should see an error page', standardTimeout, async function () {
  let classArray
  const startTime = Date.now()
  while (classArray === undefined) {
    if (Date.now() - startTime > 2000) {
      throw new Error('Timed out waiting for the error page to load')
    }
    try {
      const bodyTag = (await this.browser.queryTag('body'))[0]
      classArray = (await bodyTag.getAttribute('class'))?.split(' ')
    } catch (e) {}
  }
  ;(await expect(classArray)).to.include('nowprototypeit-error-page')
})

async function getErrorDetailElements (browser, tryCount = 0) {
  try {
    const details = (await browser.queryClass('error-description'))[0]
    const detailsAllDirectChildElements = await details.findElements(By.xpath('./*'))

    return await Promise.all(detailsAllDirectChildElements.map(async el => {
      const tagName = (await el.getTagName()).toLowerCase()
      return {
        tagName,
        text: (await el.getText()).trim()
      }
    }))
  } catch (e) {
    if (e.type === 'StaleElementReferenceError' || e.message?.startsWith('stale element reference:')) {
      if (tryCount > 5) {
        throw e
      }
      return await getErrorDetailElements(browser, tryCount + 1)
    } else {
      console.log(e)
      throw e
    }
  }
}

Then('the error details should contain additional information starting with {string}', standardTimeout, async function (startOfAdditionalInfo) {
  const info = await getErrorDetailElements(this.browser)

  const additionalDetailsIndex = info.findIndex(({
    tagName,
    text
  }) => tagName === 'dt' && text === 'Additional information:')

  if (additionalDetailsIndex === -1) {
    throw new Error('No additional information found, keys were: ' + info.filter(({ tagName }) => tagName === 'dt').map(({ text }) => `${text}`).join(', '))
  }

  const additionalDetails = await info.at(additionalDetailsIndex + 1).text

  ;(await expect(additionalDetails.split('\n')[0].trim())).to.eq(startOfAdditionalInfo)
})

function standardiseWindowsFilenamesForTestAssertion (output, index, text) {
  return output[index] === 'File path:' ? text.split(path.sep).join('/') : text
}

Then('the error details should contain {string} {string}', standardTimeout, async function (name, value) {
  const info = await getErrorDetailElements(this.browser)

  const separator = '____'
  const output = []

  info.forEach(({ tagName, text }) => {
    if (tagName === 'dt') {
      output.push(text)
    } else if (tagName === 'dd') {
      const index = output.length - 1
      const preparedText = standardiseWindowsFilenamesForTestAssertion(output, index, text)
      output[index] = output[index] + separator + preparedText
    }
  })

  const expectedValue = `${name}${separator}${value}`

  try {
    (await expect(output)).to.contain(expectedValue)
  } catch (e) {
    const err = new Error(e)
    err.stack = e.stack
    err.message = `Expected to find [${expectedValue}] in the error details, but it was not found. The error details were: [${output.join(', ')}]`
  }
})

async function getNumberElems (browser) {
  return await browser.queryClass('error-source-code__line-number')
}

async function assertLineNumber (browser, elemNumber, expectedFirstLineNumber) {
  const allLineNumberElems = await getNumberElems(browser)
  ;(await expect(await allLineNumberElems.at(elemNumber).getText())).to.eq(expectedFirstLineNumber + '.')
}

Then('the source code should start at line {int}', standardTimeout, async function (expectedFirstLineNumber) {
  await assertLineNumber(this.browser, 0, expectedFirstLineNumber)
})

Then('the source code should end at line {int}', standardTimeout, async function (expectedLastLineNumber) {
  await assertLineNumber(this.browser, -1, expectedLastLineNumber)
})

async function getHighlightedNumbers (browser) {
  const numberElems = await getNumberElems(browser)

  const lineNumberInfo = await Promise.all(numberElems.map(async elem => {
    const elemClasses = await elem.getAttribute('class')
    const classNames = elemClasses.split(' ')
    const isHighlighted = classNames.includes('error-source-code__line-number--highlighted')
    return {
      isHighlighted,
      lineNumber: (await elem.getText()).split('.')[0]
    }
  }))

  return lineNumberInfo.filter(({ isHighlighted }) => isHighlighted).map(({ lineNumber }) => lineNumber)
}

Then('only lines {int}-{int} should be highlighted', standardTimeout, async function (expectedStartOfHighlight, expectedEndOfHighlight) {
  const highlightedNumbers = await getHighlightedNumbers(this.browser)

  const expected = []

  for (let i = expectedStartOfHighlight; i <= expectedEndOfHighlight; i++) {
    expected.push(i.toString())
  }

  ;(await expect(highlightedNumbers)).to.have.all.members(expected)
})

Then('only line {int} should be highlighted', standardTimeout, async function (expectedLineNumber) {
  (await expect(await getHighlightedNumbers(this.browser))).to.eql([expectedLineNumber.toString()])
})
