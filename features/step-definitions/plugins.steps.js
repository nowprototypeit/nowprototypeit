const { Given, When, Then } = require('@cucumber/cucumber')
const { kitStartTimeout, expect, pluginActionPageTimeout, pluginActionTimeout, mediumActionTimeout, standardTimeout } = require('./utils')
const { By } = require('selenium-webdriver')
const { exec } = require('../../lib/exec')
const fsp = require('fs').promises
const path = require('path')
const { sleep } = require('../../lib/utils')
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
  ;(await expect(pluginDetails.map(({ name }) => name))).to.contain(pluginName)
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
  await browser.wait(async () => {
    const $progressBar = (await browser.driver.findElements(By.className('nowprototypeit-progress-bar')))[0]
    if ($progressBar) {
      const progressBarValue = await $progressBar.getAttribute('value')
      const progressBarMax = await $progressBar.getAttribute('max')
      return progressBarValue === progressBarMax
    }
    return false
  }, pluginActionPageTimeout.timeout)
}

function loadPluginDetailsForPluginRef (browser, pluginRef) {
  return browser.openUrl(`/manage-prototype/plugin/${pluginRef.split(':').map(encodeURIComponent).join(':')}`)
}

async function getActionButton (browser, pluginRef, buttonId, timeout) {
  const start = Date.now()
  let actionButton

  while (actionButton === undefined && (start + timeout) > Date.now()) {
    await sleep(100)
    await loadPluginDetailsForPluginRef(browser, pluginRef)
    try {
      actionButton = await browser.queryId(buttonId)
    } catch (e) {
    }
  }
  if (!actionButton) {
    throw new Error(`There is no [${buttonId}] button for plugin [${pluginRef}]`)
  }
  console.log('returning action button')
  return actionButton
}

const visitPluginPageAndRunAction = async (browser, pluginRef, buttonId, expectToWaitForAction) => {
  const $actionButton = await getActionButton(browser, pluginRef, buttonId, pluginActionTimeout.timeout / 3)
  await $actionButton.click()
  if (expectToWaitForAction) {
    await waitForPluginInstallUpdateOrUninstall(browser)
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
  console.log('dependency dir (when)', dependencyBeingTested)
  await visitPluginPageAndRunAction(this.browser, `fs:${dependencyBeingTested}`, 'action-install', true)
})

Then('I should be using version of the kit being tested', pluginActionTimeout, async function () {
  const dependencyBeingTested = getDependencyBeingTested()
  console.log('dependency dir (then)', dependencyBeingTested)
  const packageJson = await fsp.readFile(path.join(this.kit.dir, 'package.json'), 'utf8')
  const parsedPackageJson = JSON.parse(packageJson)

  kitDependencyMatches(dependencyBeingTested, parsedPackageJson.dependencies.nowprototypeit)

  await this.browser.openUrl('/manage-prototype/version')
  const kitVersion = await (await this.browser.queryId('kit-version')).getText()
  const kitDependency = await (await this.browser.queryId('npi-dependency')).getText()

  ;(await expect(kitVersion)).to.eq(currentKitVersion)
  kitDependencyMatches(dependencyBeingTested, kitDependency)
})

When('I uninstall the {string} plugin using the console', pluginActionPageTimeout, async function (pluginName) {
  await Promise.all([
    exec(`npm uninstall ${pluginName}`, { cwd: this.kit.dir })
  ])
})

When('I should be informed that {string} will also be installed', standardTimeout, async function (pluginName) {
  const $bannerHeading = (await this.browser.queryClass('notification-banner'))[0]
  if ($bannerHeading) {
    ;(await expect((await $bannerHeading.getText()).trim())).to.eq('To update this plugin, you also need to install another plugin')
  }
  const affectedPluginNames = await Promise.all((await this.browser.queryClass('affected-plugin')).map(async $li => await $li.getText()))
  ;(await expect(affectedPluginNames)).to.contain(pluginName)
})

const continueWithUpdateInstallOrUninstall = async function () {
  const $button = await this.browser.queryId('plugin-action-button')
  await $button.click()
  await waitForPluginInstallUpdateOrUninstall(this.browser)
}
When('I continue with the update', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)
When('I continue with the uninstall', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)
When('I continue with the install', pluginActionPageTimeout, continueWithUpdateInstallOrUninstall)

Given('I view the plugin details for the {string} plugin', pluginActionPageTimeout, async function (pluginRef) {
  await loadPluginDetailsForPluginRef(this.browser, pluginRef)
})

Then('I should be using version {string} of the kit from NPM', standardTimeout, async function (version) {
  const packageJson = await fsp.readFile(path.join(this.kit.dir, 'package.json'), 'utf8')
  const parsedPackageJson = JSON.parse(packageJson)
  ;(await expect(parsedPackageJson.dependencies.nowprototypeit)).to.eq(version)
})

function getDependencyBeingTested () {
  return process.env.TEST_KIT_DEPENDENCY || path.join(__dirname, '..', '..')
}

function kitDependencyMatches (dependencyBeingTested, kitDependency) {
  const kitDepExpectedStart = 'file:'
  const kitDepExpectedEnd = dependencyBeingTested

  if (!kitDependency.startsWith(kitDepExpectedStart) || !kitDependency.endsWith(kitDepExpectedEnd)) {
    throw new Error(`Expected kit dependency to start with [${kitDepExpectedStart}] and end with [${kitDepExpectedEnd}], but got [${kitDependency}]`)
  }
}
