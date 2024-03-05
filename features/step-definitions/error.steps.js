const { Then } = require('@cucumber/cucumber')
const { expect } = require('./utils')
const { By } = require('selenium-webdriver')

Then('I should see an error page', async function () {
  const bodyTag = (await this.browser.queryTag('body'))[0]
  const classArray = (await bodyTag.getAttribute('class'))?.split(' ')
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
    if (e.type === 'StaleElementReferenceError') {
      if (tryCount > 5) {
        console.log('caught StaleElementReferenceError, not retrying as retry max reached. Throwing it again.')
        throw e
      }
      console.log('caught StaleElementReferenceError, retrying')
      await getErrorDetailElements(browser, tryCount + 1)
    } else {
      console.log('caught error other than StaleElementReferenceError, throwing it again')
      throw e
    }
  }
}

Then('the error details should contain additional information starting with {string}', async function (startOfAdditionalInfo) {
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

Then('the error details should contain {string} {string}', async function (name, value) {
  const info = await getErrorDetailElements(this.browser)

  const separator = '____'
  const output = []

  info.forEach(({ tagName, text }) => {
    if (tagName === 'dt') {
      output.push(text)
    } else if (tagName === 'dd') {
      const index = output.length - 1
      output[index] = output[index] + separator + text
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

Then('the source code should start at line {int}', async function (expectedFirstLineNumber) {
  await assertLineNumber(this.browser, 0, expectedFirstLineNumber)
})

Then('the source code should end at line {int}', async function (expectedLastLineNumber) {
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

  const highlightedNumbers = lineNumberInfo.filter(({ isHighlighted }) => isHighlighted).map(({ lineNumber }) => lineNumber)
  return highlightedNumbers
}

Then('only lines {int}-{int} should be highlighted', async function (expectedStartOfHighlight, expectedEndOfHighlight) {
  const highlightedNumbers = await getHighlightedNumbers(this.browser)

  const expected = []

  for (let i = expectedStartOfHighlight; i <= expectedEndOfHighlight; i++) {
    expected.push(i.toString())
  }

  ;(await expect(highlightedNumbers)).to.have.all.members(expected)
})

Then('only line {int} should be highlighted', async function (expectedLineNumber) {
  (await expect(await getHighlightedNumbers(this.browser))).to.eql([expectedLineNumber.toString()])
})
