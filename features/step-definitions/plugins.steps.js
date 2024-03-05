const { Given, When, Then } = require('@cucumber/cucumber')
const { kitStartTimeout, expect, pluginActionPageTimeout, pluginActionTimeout, timeoutMultiplier } = require('./utils')
const { By } = require('selenium-webdriver')
const { exec } = require('../../lib/exec')
const path = require('path')

Given('I have the {string} \\({string}\\) plugin installed', pluginActionPageTimeout, async function (pluginName, pluginRef) {
  await this.browser.openUrl('/manage-prototype/plugins')
  const pluginDetails = await this.browser.getPluginDetails()
  const theMap = pluginDetails.filter(({ hasInstalledFlag }) => !!hasInstalledFlag).map(({ name }) => name)
  if (!theMap.includes(pluginName)) {
    await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', true)
  }
})

Given('I have the demo plugin {string} installed', { timeout: 40 * 1000 * timeoutMultiplier }, async function (demoPluginName) {
  const fsPath = path.resolve(__dirname, '..', 'fixtures', 'plugins', demoPluginName)
  const pluginRef = 'fs:' + fsPath
  await visitPluginPageAndRunAction(this.browser, pluginRef, 'action-install', true)
})

When('I visit the installed plugins page', kitStartTimeout, async function () {
  await this.browser.openUrl('/manage-prototype/plugins-installed')
})

When('I visit the available plugins page', async function () {
  await this.browser.openUrl('/manage-prototype/plugins')
})

Then('I should see the plugin {string} in the list', async function (pluginName) {
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.map(({ name }) => name))).to.contain(pluginName)
})

Then('I should not see the plugin {string} in the list', async function (pluginName) {
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.map(({ name }) => name))).not.to.contain(pluginName)
})

Then('The {string} plugin should be tagged as {string}', async function (pluginName, tag) {
  if (tag !== 'Installed') {
    throw new Error(`Don't know how to handle tag [${tag}]`)
  }
  const pluginDetails = await this.browser.getPluginDetails()
  ;(await expect(pluginDetails.filter(x => x.hasInstalledFlag).map(({ name }) => name))).to.contain(pluginName)
})

Then('The {string} plugin should not be tagged as {string}', async function (pluginName, tag) {
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

const visitPluginPageAndRunAction = async (browser, pluginRef, buttonId, expectToWaitForAction) => {
  await browser.openUrl(`/manage-prototype/plugin/${encodeURIComponent(pluginRef)}`)
  let uninstallButton
  try {
    uninstallButton = await browser.queryId(buttonId)
  } catch (e) {
    throw new Error(`There is no [${buttonId}] button for plugin [${pluginRef}]`)
  }
  await uninstallButton.click()
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

When('I uninstall the {string} plugin using the console', pluginActionPageTimeout, async function (pluginName) {
  await Promise.all([
    exec(`npm uninstall ${pluginName}`, { cwd: this.kit.dir })
  ])
})

When('I should be informed that {string} will also be installed', async function (pluginName) {
  const $bannerHeading = (await this.browser.queryClass('govuk-notification-banner__heading'))[0]
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
