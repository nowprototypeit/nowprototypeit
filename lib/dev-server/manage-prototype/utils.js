const { promises: fsp } = require('fs')
const path = require('path')

let reloaderScriptPromise
const contextPath = '/manage-prototype'
const managementLinks = [
  {
    text: 'Home',
    url: contextPath
  },
  {
    text: 'Templates',
    url: contextPath + '/templates'
  },
  {
    text: 'Plugins',
    url: contextPath + '/plugins'
  },
  {
    text: 'Settings',
    url: contextPath + '/settings'
  },
  {
    text: 'Clear session data',
    url: contextPath + '/clear-data'
  }
]

function getManagementView (filename) {
  return [filename].join('/')
}

function warmUpReloaderScript () {
  reloaderScriptPromise = fsp.readFile(path.join(__dirname, 'assets', 'scripts', 'reloader-client.js'), 'utf8')
}

async function getReloaderScript () {
  if (!reloaderScriptPromise) {
    warmUpReloaderScript()
  }

  return (await reloaderScriptPromise).replace('__DATE__', new Date().getTime())
}

const pluginLogger = function () {
  if (process.env.VERBOSE !== 'true') {
    return
  }
  console.log('[PLUGINS]', ...arguments)
}

module.exports = {
  contextPath,
  managementLinks,
  getManagementView,
  getReloaderScript,
  warmUpReloaderScript,
  pluginLogger
}
