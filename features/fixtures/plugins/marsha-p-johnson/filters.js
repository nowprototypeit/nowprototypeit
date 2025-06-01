try {
  const { addFilter } = require('nowprototypeit').views
  const { getPluginSpecificConfig } = require('nowprototypeit').config

  const uppercaseTitles = getPluginSpecificConfig('marsha-p-johnson').upperCaseTitles

  console.log('got upper case titles from config: ', uppercaseTitles)

  addFilter('caseBasedOnSettings', (input) => uppercaseTitles ? input.toUpperCase() : input)
} catch (e) {
  console.log('error reading mpj config - this happens when Cucumber tries to load all the JS files before running the tests')
}
