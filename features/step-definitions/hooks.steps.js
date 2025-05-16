const { Before, AfterStep, AfterAll, After, setDefaultTimeout, BeforeStep } = require('@cucumber/cucumber')

const { setupKitAndBrowserForTestScope, removeKit } = require('./utils')

const colors = require('../../lib/utils/terminal-colors')
const { sleep } = require('../../lib/utils')
const path = require('path')
const os = require('os')
const { runShutdownFunctions } = require('../../lib/utils/shutdownHandlers')
const standardTimeout = require('./utils')
const { kitStartTimeout } = require('./setup-helpers/timeouts')
const resultsByTag = {}
let anyFailures = false
let anyPasses = false

setDefaultTimeout(1)

const experimentTagSettings = {
  '@respect-file-extensions-experiment-on': {
    respectFileExtensions: true
  },
  '@edit-in-browser-experiment-on': {
    editInBrowser: true
  },
  '@hosting-experiment-on': {
    hostingEnabled: true
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
  '@kit-update-from-0.9.4': {
    neverReuseThisKit: true,
    variantPluginName: '@nowprototypeit/design-system',
    kitDependency: 'nowprototypeit@0.9.4',
    kitCreateVersionSetting: '0.9.4'
  }
}

function getVariantConfig (variantTag) {
  const result = variantConfigs[variantTag]
  if (result && result.neverReuseThisKit) {
    return Object.assign({}, result, { unique: Date.now() })
  }
  return result
}

Before(standardTimeout, async function () {
  console.log('') // without this the 'first' dot in each run is actually the cleanup from the last run.
})
const configuredToLogEachStep = process.env.LOG_EACH_STEP === 'true'
if (configuredToLogEachStep) {
  BeforeStep(standardTimeout, async function (scenario) {
    console.log('')
    const content = `Starting step ${scenario.pickleStep.text}`
    const topAndBottomOfBox = '-'.repeat(content.length + 6)
    console.log(topAndBottomOfBox)
    console.log(`|  ${content}  |`)
    console.log(topAndBottomOfBox)
  })
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

const ms = parseInt(process.env.DELAY_BETWEEN_TESTS, 10)
AfterStep({ timeout: ms + 1000 }, async function (info) {
  if (configuredToLogEachStep) {
    if (info.result.status === 'PASSED') {
      console.log('step passed')
    } else {
      console.log('step failed')
      console.log(info.result.exception)
    }
  }

  if (process.env.DELAY_BETWEEN_TESTS) {
    await sleep(ms)
  }
})

After(kitStartTimeout, async function (scenario) {
  const isFailure = scenario.result.status === 'FAILED'
  const scenarioName = scenario.pickle.name
  if (isFailure) {
    anyFailures = true
    console.log('')
    console.log(' - - - ')
    console.log('Full kit stderr:')
    console.log('')
    console.log(this.kit?.getFullStderr())
    console.log('')
    console.log(' - - - ')
    console.log('')
  } else {
    anyPasses = true
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
      const file = path.join(process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'nowprototypeit-test-failures'), (scenarioName || Date.now()).replaceAll(' ', '-').replaceAll('.', '-') + '-failure-screenshot.png')
      this.browser.takeScreenshot(file)
    }
    if (process.env.DELAY_AFTER_FAILED_TEST !== undefined) {
      await sleep(parseInt(process.env.DELAY_AFTER_FAILED_TEST, 10))
    }
    process.exitCode = 10
  }
  if (!this.kit?.neverReuseThisKit) {
    await this.kit?.reset()
    await this.fakeApi?.reset()
    await this.browser?.openUrl('about:blank')
  }
  if (process.env.DELAY_BETWEEN_TESTS) {
    await sleep(parseInt(process.env.DELAY_BETWEEN_TESTS, 10))
  }
})

AfterAll(kitStartTimeout, async function () {
  if (configuredToLogEachStep) {
    console.log('starting after all')
  }
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

  console.log('')
  console.log('')
  console.log('Starting cleanup')
  await runShutdownFunctions()
  console.log('Cleanup complete')
  if (!anyPasses && !anyFailures) {
    console.log('')
    console.log('No tests run, failing.')
    console.log('')
    process.exit(100)
  }
})
