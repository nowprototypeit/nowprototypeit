const { Before, AfterStep, AfterAll, After, setDefaultTimeout } = require('@cucumber/cucumber')
const { kitStartTimeout, cleanupEverything, setupKitAndBrowserForTestScope } = require('./utils')
const colors = require('ansi-colors')
const { sleep } = require('../../lib/utils')
const path = require('path')
const os = require('os')
const fsp = require('fs').promises

setDefaultTimeout(1)

const variantConfigs = {
  '@no-variant': {},
  '@govuk-variant': {
    variantPluginName: '@nowprototypeit/govuk-frontend-adaptor'
  },
  '@mpj-variant': {
    variantPluginName: 'marsha-p-johnson',
    variantPluginDependency: path.join(__dirname, '..', 'fixtures', 'plugins', 'marsha-p-johnson')
  }
}

Before(kitStartTimeout, async function (scenario) {
  const variantTags = scenario.pickle.tags.map(x => x.name).filter(x => x.endsWith('-variant'))
  if (variantTags.length > 1) {
    throw new Error('More than one variant tag found: ' + JSON.stringify(variantTags))
  }
  const variantTag = variantTags[0]
  if (!variantTag) {
    return
  }
  const variantConfig = variantConfigs[variantTag]
  if (!variantConfig) {
    throw new Error('Unknown variant tag: ' + variantTag)
  }

  await setupKitAndBrowserForTestScope(this, variantConfig)
})

if (process.env.DELAY_BETWEEN_TESTS) {
  const ms = parseInt(process.env.DELAY_BETWEEN_TESTS, 10)
  AfterStep({ timeout: ms + 1000 }, async function () {
    await sleep(ms)
  })
}

After(kitStartTimeout, async function (scenario) {
  const isFailure = scenario.result.status === 'FAILED'
  const scenarioName = scenario.pickle.name
  this.kit?.reset()
  process.stdout.write(colors.bold(' ' + (isFailure ? colors.red('✘ ' + scenarioName) : colors.green('✓ ' + scenarioName))))
  console.log('')
  if (isFailure) {
    if (process.env.TAKE_SCREENSHOT_AFTER_FAILURE === 'true') {
      try {
        await this.browser?.setWindowSizeToPageSize()
      } catch (e) {}
      const file = path.join(process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'nowprototypeit-test-failures'), (scenarioName || Date.now()).replaceAll(' ', '-').replaceAll('.', '-') + '-failure-screenshot.png')
      const image = await this.browser?.driver.takeScreenshot()
      if (image) {
        await fsp.mkdir(path.dirname(file), { recursive: true })
        await fsp.writeFile(file, image, 'base64')
      }
    }
    if (process.env.DELAY_AFTER_FAILED_TEST !== undefined) {
      await sleep(parseInt(process.env.DELAY_AFTER_FAILED_TEST, 10))
    }
    process.exitCode = 10
  }
  this.browser?.openUrl('about:blank')
  if (process.env.DELAY_BETWEEN_TESTS) {
    await sleep(parseInt(process.env.DELAY_BETWEEN_TESTS, 10))
  }
})

AfterAll(kitStartTimeout, async function () {
  const kitShouldBeDeleted = process.env.LEAVE_KIT_AFTER_TEST !== 'true'

  await cleanupEverything(kitShouldBeDeleted)
})
