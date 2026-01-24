const { When, Then } = require('@cucumber/cucumber')
const { waitForConditionToBeMet, readFixtureFile, readPrototypeFile } = require('./utils')
const { standardTimeout, tinyTimeout } = require('./setup-helpers/timeouts')

When('I open the in-browser editor', standardTimeout, async function () {
  await waitForConditionToBeMet(standardTimeout, async () => {
    const text = await this.browser.getTextFromSelector('#nowprototypeit-in-browser-bar_edit-button')
    const editInBrowserExpectedText = 'Edit this page'
    if (!text || text !== editInBrowserExpectedText) {
      throw new Error(`Edit in browser button not found or text is incorrect - expected [${editInBrowserExpectedText}], got [${text}]`)
    }
    return true
  })
  await this.browser.clickId('nowprototypeit-in-browser-bar_edit-button')
})

async function getContentsFromEditor (browser) {
  return (await browser.getTextFromSelectorAll('.nowprototypeit-in-browser-editor__editor .lines-content .view-line', tinyTimeout, false)).join('\n').replaceAll(' ', ' ')
}

Then('I should see the contents of {string} in the in-browser editor', standardTimeout, async function (fileRelativePath) {
  let actual
  const expected = replaceWindowsLineBreaks(await readPrototypeFile(this.kit, fileRelativePath))
  await waitForConditionToBeMet(standardTimeout, async () => {
    actual = await getContentsFromEditor(this.browser)
    return actual === expected
  }, (reject) => {
    reject(new Error(`Expected editor content to equal [${expected}], but was [${actual}]`))
  })
})

When('I replace the contents of the in-browser editor with the fixture file {string}', standardTimeout, async function (fixtureFilePath) {
  const fixtureFileContents = await readFixtureFile(fixtureFilePath)
  let lastKnownContents

  await waitForConditionToBeMet(standardTimeout, async () => {
    await this.browser.setEditorContents(fixtureFileContents, tinyTimeout)
    lastKnownContents = await getContentsFromEditor(this.browser)
    return lastKnownContents === fixtureFileContents
  }, () => {
    throw new Error(`Failed to set editor contents to fixture file contents. Last known contents: [${lastKnownContents}], expected contents: [${fixtureFileContents}]`)
  })
})

When('I press the save button for the in-browser editor', standardTimeout, async function () {
  await this.browser.clickButtonWithText('Save changes')
})

function replaceWindowsLineBreaks (str) {
  if (!str?.replaceAll) {
    return str
  }
  return str.replaceAll('\r\n', '\n')
}

Then('the file {string} should contain the same content as the fixture file {string}', standardTimeout, async function (string, string2) {
  let actual
  const expected = await readFixtureFile(string2)
  await waitForConditionToBeMet(standardTimeout, async () => {
    actual = await readPrototypeFile(this.kit, string)

    return replaceWindowsLineBreaks(actual) === replaceWindowsLineBreaks(expected)
  }, (reject) => {
    reject(new Error(`Expected file to contain ${expected}, but was ${actual}`))
  })
})
