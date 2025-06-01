const Module = require('module')
const path = require('path')

module.exports = {
  replaceRequire: () => {
    const originalRequire = Module.prototype.require
    Module.prototype.require = function (modulePath) {
      if (modulePath === 'govuk-prototype-kit' || modulePath === 'nowprototypeit' || modulePath === 'prototype-core') {
        if (modulePath === 'govuk-prototype-kit') {
          console.log('We replaced a require(\'govuk-prototype-kit\') with require(\'nowprototypeit\')')
        }
        return originalRequire.call(this, path.join(__dirname, '..', '..', 'index.js'))
      }
      if (modulePath === 'govuk-prototype-kit/lib/config.js') {
        console.log('We replaced a require(\'govuk-prototype-kit/lib/config.js\') with require(\'nowprototypeit/lib/config.js\')')
        return originalRequire.call(this, path.join(__dirname, '..', 'config.js'))
      }
      return originalRequire.call(this, modulePath)
    }
  }
}
