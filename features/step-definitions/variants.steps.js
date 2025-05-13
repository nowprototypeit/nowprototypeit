const { Then } = require('@cucumber/cucumber')
const { exec } = require('../../lib/exec')
const { expect } = require('./utils')
const { standardTimeout } = require('./setup-helpers/timeouts')

Then('my project should be set up to use git', standardTimeout, async function () {
  let result = ''
  await exec('git log', {
    cwd: this.kit.dir
  }, (data) => {
    result += data.toString()
  })
  ;(await expect(result)).to.contain('commit')
  ;(await expect(result)).to.contain('Author:')
  ;(await expect(result)).to.contain('Date:')
})

Then('all my plugins should be on the latest version', standardTimeout, async function () {
  const a = (await this.browser.getPluginDetails()).filter(({ updateAvailable }) => updateAvailable)
  if (a.length > 0) {
    throw new Error(`The following plugins have updates available: ${a.map(({ name }) => name).join(', ')}`)
  }
})
