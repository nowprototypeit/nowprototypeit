const { Before, AfterStep, AfterAll, After, setDefaultTimeout } = require('@cucumber/cucumber')
const { kitStartTimeout, cleanupEverything, setupKitAndBrowserForTestScope, removeKit } = require('./utils')

const colors = require('../../lib/utils/terminal-colors')
const { sleep } = require('../../lib/utils')
const path = require('path')
const os = require('os')
const fsp = require('fs').promises
const resultsByTag = {}
let anyFailures = false

setDefaultTimeout(1)

const experimentTagSettings = {
  '@respect-file-extensions-experiment-on': {
    respectFileExtensions: true
  },
  '@edit-in-browser-experiment-on': {
    editInBrowser: true
  }
}

const variantConfigs = {
  '@no-variant': {},
  '@govuk-variant': {
    variantPluginName: '@nowprototypeit/govuk-frontend-adaptor'
  },
  '@npi-variant': {
    variantPluginName: '@nowprototypeit/design-system'
  },
  '@mpj-variant': {
    variantPluginName: 'marsha-p-johnson',
    variantPluginDependency: path.join(__dirname, '..', 'fixtures', 'plugins', 'marsha-p-johnson')
  },
  '@lma-variant': {
    variantPluginName: 'louisa-may-alcott',
    variantPluginDependency: path.join(__dirname, '..', 'fixtures', 'plugins', 'louisa-may-alcott')
  },
  '@kit-update': {
    neverReuseThisKit: true,
    variantPluginName: '@nowprototypeit/design-system'
  },
  '@kit-update-from-0.9.0': {
    neverReuseThisKit: true,
    variantPluginName: '@nowprototypeit/design-system',
    kitDependency: 'nowprototypeit@0.9.0',
    kitCreateVersionSetting: '0.9.0'
  }
}

function getVariantConfig (variantTag) {
  const result = variantConfigs[variantTag]
  if (result && result.neverReuseThisKit) {
    return Object.assign({}, result, { unique: Date.now() })
  }
  return result
}

Before(kitStartTimeout, async function (scenario) {
  const tagNames = scenario.pickle.tags.map(x => x.name)
  const variantTags = tagNames.filter(x => x.endsWith('-variant') || x.startsWith('@kit-update'))
  if (variantTags.length > 1) {
    throw new Error('More than one variant tag found: ' + JSON.stringify(variantTags))
  }
  const variantTag = variantTags[0]
  if (!variantTag) {
    throw new Error('No variant tag found')
  }
  const variantConfig = getVariantConfig(variantTag)

  const appConfigAdditions = Object.keys(experimentTagSettings)
    .filter(tag => tagNames.includes(tag)).map(key => experimentTagSettings[key])
    .reduce((acc, value) => ({ ...acc, ...value }), {})

  if (!variantConfig) {
    throw new Error('Unknown variant tag: ' + variantTag)
  }

  variantConfig.appConfigAdditions = appConfigAdditions

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
  if (isFailure) {
    anyFailures = true
  }
  if (scenario.willBeRetried) {
    await removeKit(this.kit)
  }
  process.stdout.write(colors.bold(' ' + (isFailure ? colors.red('✘ ' + scenarioName) : colors.green('✓ ' + scenarioName))))
  console.log('')

  scenario.pickle.tags.forEach(tag => {
    resultsByTag[tag.name] = resultsByTag[tag.name] || { successes: 0, failures: 0 }
    resultsByTag[tag.name][isFailure ? 'failures' : 'successes']++
  })

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
  await this.kit?.reset()
  this.browser?.openUrl('about:blank')
  if (process.env.DELAY_BETWEEN_TESTS) {
    await sleep(parseInt(process.env.DELAY_BETWEEN_TESTS, 10))
  }
})

AfterAll(kitStartTimeout, async function () {
  if (anyFailures) {
    console.log('')
    console.log('----')
    console.log('')
    console.log('Results by tag:')
    const longestTag = Object.keys(resultsByTag).reduce((acc, tag) => Math.max(acc, tag.length), 0)
    Object.keys(resultsByTag)
      .map(key => ({
        tag: key,
        percentageFailed: resultsByTag[key].failures / (resultsByTag[key].successes + resultsByTag[key].failures) * 100
      }))
      .filter(({ percentageFailed }) => percentageFailed > 0)
      .sort((a, b) => b.percentageFailed - a.percentageFailed)
      .forEach(({ tag, percentageFailed }) => {
        console.log(`  ${`${tag}:`.padEnd(longestTag + 3, ' ')} ${Math.round(percentageFailed * 10) / 10}% failures`)
      })
    console.log('')
    console.log('----')
    console.log('')
  }

  const kitShouldBeDeleted = process.env.LEAVE_KIT_AFTER_TEST !== 'true'

  await cleanupEverything(kitShouldBeDeleted)
})
