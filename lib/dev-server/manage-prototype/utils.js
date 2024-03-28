const {promises: fsp} = require('fs')
const path = require('path')
const {getConfig} = require("../../config");

let reloaderScriptPromise
const contextPath = '/manage-prototype'

const getManagementLinks = () => {
  const standardLinks = [
    {
      name: 'Home',
      url: contextPath
    },
    {
      name: 'Templates',
      url: contextPath + '/templates'
    },
    {
      name: 'Plugins',
      url: contextPath + '/plugins',
      alternativeUrlsInSection: [
        contextPath + '/plugin'
      ]
    },
    {
      name: 'Settings',
      url: contextPath + '/settings'
    },
    {
      name: 'Clear session data',
      url: contextPath + '/clear-data'
    }
  ]
  const extraLinks = []
  if (getConfig().nowUserResearchItAPIBaseUrl) {
    extraLinks.push({
      name: 'Hosting',
      url: contextPath + '/hosting'
    })
  }
  extraLinks.push({
      name: 'Back to your prototype',
      url: '/'
    }
  )
  return standardLinks.concat(extraLinks)
}

const getNavLinks = (req, linksObj, partToCompare) => {
  const relevantPart = req.originalUrl.split('/')[partToCompare]

  function isCurrentPage(link) {
    if (link.url === '/') {
      return false
    }
    const linkPart = link.url.split('/')[partToCompare]
    if (linkPart === relevantPart) {
      return true
    }
    if ((relevantPart || '').startsWith(linkPart)) {
      return true
    }
    if (link.alternativeUrlsInSection) {
      return link.alternativeUrlsInSection.some(altUrl => isCurrentPage({url: altUrl}))
    }
    return false
  }

  return linksObj.map(link => ({
    ...link,
    isCurrentPage: isCurrentPage(link)
  }))
}

const getPageNavLinks = (req) => {
  return getNavLinks(req, getManagementLinks(), 2)
}

function getManagementView(filename) {
  return [filename].join('/')
}

function warmUpReloaderScript() {
  reloaderScriptPromise = fsp.readFile(path.join(__dirname, 'assets', 'scripts', 'reloader-client.js'), 'utf8')
}

async function getReloaderScript() {
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

const awaitOrResolveWithDefault = (promise, timeoutMS, timeoutMessage) => {
  return new Promise((resolve) => {
    let hasResponded = false
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true
        resolve(timeoutMessage)
      }
    }, timeoutMS)
    promise.then((response) => {
      clearTimeout(timeout)
      if (!hasResponded) {
        hasResponded = true
        resolve(response)
      }
    })
  })
}

module.exports = {
  contextPath,
  getManagementView,
  getReloaderScript,
  warmUpReloaderScript,
  pluginLogger,
  getPageNavLinks,
  getNavLinks,
  awaitOrResolveWithDefault
}
