const { Given, When, Then } = require('@cucumber/cucumber')
const { expect, waitForConditionToBeMet } = require('./utils')
const { exec } = require('../../lib/exec')
const fsp = require('fs').promises
const path = require('path')
const os = require('os')
const {
  pluginActionPageTimeout, pluginActionTimeout, kitStartTimeout, mediumActionTimeout, standardTimeout,
  tinyTimeout
} = require('./setup-helpers/timeouts')
const currentKitVersion = require('../../package.json').version

Given('I have the {string} \\({string}\\) plugin installed', pluginActionPageTimeout, async function (pluginName, pluginRef) {
  await this.browser.openUrl('/manage-prototype/plugins')
  const pluginDetails = await this.browser.getPluginDetails()
  const theMap = pluginDetails.filter(({ hasInstalledFlag }) => !!hasInstalledFlag).map(({ name }) => name)
  if (!theMap.includes(pluginName)) {
    await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', true)
  }
})

Given('I have the demo plugin {string} installed', pluginActionTimeout, async function (demoPluginName) {
  const fsPath = path.resolve(__dirname, '..', 'fixtures', 'plugins', demoPluginName)
  const pluginRef = 'fs:' + fsPath
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', true)
})

When('I visit the installed plugins page', kitStartTimeout, async function () {
  await this.browser.openUrl('/manage-prototype/plugins/installed')
})

When('I visit the available plugins page', mediumActionTimeout, async function () {
  await this.browser.openUrl('/manage-prototype/plugins/discover')
})

Then('I should see the plugin {string} in the list', mediumActionTimeout, async function (pluginName) {
  const pluginDetails = await this.browser.getPluginDetails()
  const pluginNames = pluginDetails.map(({ name }) => name)
  const success = pluginNames.includes(pluginName)
  if (!success) {
    throw new Error(`Plugin [${pluginName}] not found in list of plugins [${pluginNames.join(', ')}]`)
  }
})

Then('I should have no plugins installed', standardTimeout, async function () {
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.length)).to.equal(0)
})

Then('I should not see the plugin {string} in the list', standardTimeout, async function (pluginName) {
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.map(({ name }) => name))).not.to.contain(pluginName)
})

Then('The {string} plugin should be tagged as {string}', standardTimeout, async function (pluginName, tag) {
  if (tag !== 'Installed') {
    throw new Error(`Don't know how to handle tag [${tag}]`)
  }
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.filter(x => x.hasInstalledFlag).map(({ name }) => name))).to.contain(pluginName)
})

Then('The {string} plugin should not be tagged as {string}', standardTimeout, async function (pluginName, tag) {
  if (tag !== 'Installed') {
    throw new Error(`Don't know how to handle tag [${tag}]`)
  }
  const pluginDetails = await this.browser.getPluginDetails()
  const notInstalledPlugins = pluginDetails.filter(x => !x.hasInstalledFlag)
  ;(await expect(notInstalledPlugins.map(({ name }) => name))).to.contain(pluginName)
})

async function waitForPluginInstallUpdateOrUninstall (browser) {
  let progressBarValue = -1
  await waitForConditionToBeMet(pluginActionPageTimeout, async () => {
    const { value, max } = (await browser.getProgressBarValueAndMax())
    progressBarValue = value
    return progressBarValue === max
  }, (reject) => {
    reject(new Error(`Gave up waiting for progress bar to complete. Progress bar value was [${progressBarValue}]`))
  })
}

function loadPluginDetailsForPluginRef (browser, pluginRef) {
  return browser.openUrl(`/manage-prototype/plugin/${pluginRef.split(':').map(encodeURIComponent).join(':')}`)
}

const visitPluginPageAndRunAction = async (browser, pluginRef, buttonId, expectToWaitForAction) => {
  await loadPluginDetailsForPluginRef(browser, pluginRef)
  await browser.clickId(buttonId)
  if (expectToWaitForAction) {
    await waitForPluginInstallUpdateOrUninstall(browser)
    const successMessage = await browser.getTextFromSelector('#instructions-complete h3', tinyTimeout).catch(() => undefined)
    const errorPanelText = await browser.getTextFromSelector('.panel-error', tinyTimeout).catch(() => undefined)
    if (errorPanelText) {
      throw new Error(`Error panel found after install, text was [${errorPanelText.split('\n')[0]}]`)
    }
    if (!successMessage?.startsWith('Successfully installed')) {
      throw new Error('No success message')
    }
  }
}

Given('I uninstall the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-uninstall', true)
})
Given('I try to uninstall the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-uninstall', false)
})

When('I install the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', true)
})
When('I try to install the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', false)
})

When('I update the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-update', true)
})
When('I try to update the {string} plugin', pluginActionTimeout, async function (pluginRef) {
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-update', false)
})
When('I install the {string} version of the kit from NPM', pluginActionTimeout, async function (version) {
  await visitPluginPageAndRunAction(this.browser, `npm:nowprototypeit:${version}`, 'action-install', true)
})
When('I install the version of the kit being tested', pluginActionTimeout, async function () {
  const dependencyBeingTested = getDependencyBeingTested()
  await visitPluginPageAndRunAction(this.browser, `fs:${dependencyBeingTested}`, 'action-install', true)
})

Then('I should be using version of the kit being tested', pluginActionTimeout, async function () {
  const dependencyBeingTested = getDependencyBeingTested()
  const packageJson = await fsp.readFile(path.join(this.kit.dir, 'package.json'), 'utf8')
  const parsedPackageJson = JSON.parse(packageJson)

  kitDependencyMatches(path.relative(this.kit.dir, dependencyBeingTested), parsedPackageJson.dependencies.nowprototypeit)

  await this.browser.openUrl('/manage-prototype/version')
  const kitVersion = await this.browser.getTextFromSelector('#kit-version')

  ;(await expect(kitVersion)).to.eq(currentKitVersion)
})

When('I uninstall the {string} plugin using the console', pluginActionPageTimeout, async function (pluginName) {
  await Promise.all([
    exec(`npm uninstall ${pluginName}`, { cwd: this.kit.dir })
  ])
})

When('I should be informed that {string} will also be installed', standardTimeout, async function (pluginName) {
  const content = await this.browser.getTextFromSelector('.notification-banner')
  ;(await expect(content)).to.eq('To update this plugin, you also need to install another plugin')

  const contentArr = await this.browser.getTextFromSelectorAll('.affected-plugin')
  ;(await expect(contentArr)).to.contain(pluginName)
})

const continueWithUpdateInstallOrUninstall = async function () {
  this.browser.clickButtonWithId('plugin-action-button')
  await waitForPluginInstallUpdateOrUninstall(this.browser)
}
When('I continue with the update', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)
When('I continue with the uninstall', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)
When('I continue with the install', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)

Given('I view the plugin details for the {string} plugin', pluginActionPageTimeout, async function (pluginRef) {
  await loadPluginDetailsForPluginRef(this.browser, pluginRef)
})

Given('I view the plugin details for the {string} fixture plugin', pluginActionPageTimeout, async function (fixturePluginName) {
  const fixturePluginPath = path.join(__dirname, '..', 'fixtures', 'plugins', fixturePluginName)
  await loadPluginDetailsForPluginRef(this.browser, `fs:${fixturePluginPath}`)
})

Given('I view the plugin details for the tar.gz version of the {string} fixture plugin', pluginActionPageTimeout, async function (fixturePluginName) {
  const fixturePluginPath = path.join(__dirname, '..', 'fixtures', 'plugins', fixturePluginName)
  const dir = path.join(os.tmpdir(), 'npi', 'test-fixture-plugin-tar', '' + Date.now())
  await fsp.mkdir(dir, { recursive: true })
  const outputLines = []
  const stdoutAndStderrHandler = (data) => {
    outputLines.push(data.toString())
  }

  await exec(`npm pack --pack-destination=${dir}`, { cwd: fixturePluginPath }, stdoutAndStderrHandler, stdoutAndStderrHandler)
  const fileName = outputLines.join('\n').split('\n').filter(x => !!x).at(-1)
  const tgzPath = path.join(dir, fileName)
  await loadPluginDetailsForPluginRef(this.browser, `fs:${tgzPath}`)
})

Then('I should be using version {string} of the kit from NPM', standardTimeout, async function (version) {
  const packageJson = await fsp.readFile(path.join(this.kit.dir, 'package.json'), 'utf8')
  const parsedPackageJson = JSON.parse(packageJson)
  await (await expect(parsedPackageJson.dependencies.nowprototypeit)).to.eq(version)
})

Then('I should see the {string} button', standardTimeout, async function (buttonText) {
  await waitForConditionToBeMet(standardTimeout, async () => {
    const buttonTextList = await this.browser.getAllButtonTexts()
    if (!buttonTextList.includes(buttonText)) {
      throw new Error(`Expected to find button with text [${buttonText}] but found [${buttonTextList.join(', ')}]`)
    }
    return true
  })
})

Then('I should not see the {string} button', standardTimeout, async function (version) {
  const buttonTextList = await this.browser.getAllButtonTexts()
  ;(await expect(buttonTextList)).not.to.include(version)
})

function getDependencyBeingTested () {
  return process.env.TEST_KIT_DEPENDENCY || path.join(__dirname, '..', '..')
}

function kitDependencyMatches (dependencyBeingTested, kitDependency) {
  const kitDepExpectedStart = 'file:'
  const kitDepExpectedEnd = dependencyBeingTested.replaceAll('\\', '/')
  const preparedKitDependency = kitDependency.replaceAll('\\', '/')

  if (!preparedKitDependency.startsWith(kitDepExpectedStart) || !preparedKitDependency.endsWith(kitDepExpectedEnd)) {
    throw new Error(`Expected kit dependency to start with [${kitDepExpectedStart}] and end with [${kitDepExpectedEnd}], but got [${preparedKitDependency}]`)
  }
}
