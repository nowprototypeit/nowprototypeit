const { When, Then } = require('@cucumber/cucumber')
const { standardTimeout, waitForConditionToBeMet, readFixtureFile, readPrototypeFile } = require('./utils')
const waitForEditorElem = getEditorElem

When('I open the in-browser editor', standardTimeout, async function () {
  const $button = await this.browser.queryId('nowprototypeit-in-browser-bar_edit-button')
  await $button.click()
})

async function getEditorElem (browser) {
  let $elem
  await waitForConditionToBeMet(standardTimeout, async () => {
    const $elems = await browser.queryCss('.nowprototypeit-in-browser-editor__editor .lines-content')
    if ($elems.length === 0) {
      return false
    }
    $elem = $elems[0]
    return true
  }, () => {
    throw new Error('Waiting for editor to load but it never did')
  })
  return $elem
}

Then('I should see the contents of {string} in the in-browser editor', standardTimeout, async function (fileRelativePath) {
  await waitForEditorElem(this.browser)

  let actual
  const expected = (await readPrototypeFile(this.kit, fileRelativePath))
  await waitForConditionToBeMet(standardTimeout, async () => {
    actual = await getEditorContents(this.browser)

    return actual === expected
  }, () => {
    throw new Error(`Expected editor to contain ${expected}, but was ${actual}`)
  })
})

When('I replace the contents of the in-browser editor with the fixture file {string}', standardTimeout, async function (fixtureFilePath) {
  await waitForEditorElem(this.browser)
  const fixtureFileContents = await readFixtureFile(fixtureFilePath)

  await setEditorContents(this.browser, fixtureFileContents)
})

When('I press the save button for the in-browser editor', standardTimeout, async function () {
  const $saveButton = await this.browser.queryId('nowprototypeit-in-browser-editor__submit-button')
  await $saveButton.click()
})

Then('the file {string} should contain the same content as the fixture file {string}', standardTimeout, async function (string, string2) {
  let actual
  const expected = await readFixtureFile(string2)
  await waitForConditionToBeMet(standardTimeout, async () => {
    actual = await readPrototypeFile(this.kit, string)

    return actual === expected
  }, () => {
    throw new Error(`Expected file to contain ${expected}, but was ${actual}`)
  })
})

async function getEditorContents (browser) {
  return await browser.executeScript('return window.NOW_PROTOTYPE_IT.__for_automation_only_currentEditor.getValue()')
}

async function setEditorContents (browser, val) {
  return await browser.executeScript('window.NOW_PROTOTYPE_IT.__for_automation_only_currentEditor.setValue(`' + val.replaceAll('`', '\\`') + '`)')
}
