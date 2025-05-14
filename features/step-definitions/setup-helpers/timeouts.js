const path = require('path')

const initialTimeoutMultiplier = process.env.TIMEOUT_MULTIPLIER || path.sep === '/' ? 1 : 3
const additionalTimeoutMultiplier = Number(process.env.ADDITIONAL_TIMEOUT_MULTIPLIER ? process.env.ADDITIONAL_TIMEOUT_MULTIPLIER : 1)
const timeoutMultiplier = initialTimeoutMultiplier * additionalTimeoutMultiplier

const standardTimeout = { timeout: 5 * 1000 * timeoutMultiplier }

module.exports = {
  timeoutMultiplier,
  kitStartTimeout: { timeout: (process.env.TEST_KIT_DEPENDENCY ? 90 : 40) * 1000 * timeoutMultiplier },
  standardTimeout,
  tinyTimeout: { timeout: 0.5 * 1000 * timeoutMultiplier },
  pluginActionTimeout: { timeout: 60 * 1000 * timeoutMultiplier },
  pluginActionPageTimeout: { timeout: 20 * 1000 * timeoutMultiplier },
  mediumActionTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  pageRefreshTimeout: { timeout: 10 * 1000 * timeoutMultiplier },
  intentionalDelayTimeout: { timeout: 60 * 60 * 1000 },
  styleBuildTimeout: { timeout: 30 * 1000 * timeoutMultiplier }
}
