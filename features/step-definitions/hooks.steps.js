const { Before, AfterAll, After } = require('@cucumber/cucumber')
const { exec } = require('../../lib/exec')
const { kitStartTimeout, getPrototypeKitAndBrowser, cleanupEverything } = require('./utils')
const colors = require('ansi-colors')

Before(kitStartTimeout, async function () {
  const { kit, browser, isReused } = await getPrototypeKitAndBrowser()
  browser.setBaseUrl(kit.url)
  this.kit = kit
  this.browser = browser

  const runCommand = async (command) => {
    let result = ''
    await exec(command, {
      cwd: this.kit.dir
    }, (data) => {
      result += data.toString()
    })
    return result
  }

  if (isReused) {
    const status = await runCommand('git status')

    await runCommand('git stash')

    if (status.includes('package.json')) {
      await runCommand('npm prune')
      await runCommand('npm install')

      const restartPromise = new Promise((resolve) => {
        this.kit.addNextRestartListener(() => {
          resolve()
        })
      })
      this.kit.sendStdin('rs kit')
      await restartPromise
    }
  }
})

After(kitStartTimeout, async function (scenario) {
  const isFailure = scenario.result.status === 'FAILED'
  process.stdout.write(colors.bold(' ' + (isFailure ? colors.red('✘') : colors.green(' ✓'))))
  console.log('')
  if (isFailure) {
    process.exitCode = 10
  }
})

AfterAll(kitStartTimeout, async function () {
  const kitShouldBeDeleted = process.env.LEAVE_KIT_AFTER_TEST !== 'true'

  await cleanupEverything(kitShouldBeDeleted)
})
