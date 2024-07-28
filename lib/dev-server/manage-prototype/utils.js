const { promises: fsp } = require('fs')
const path = require('path')

let reloaderScriptPromise
let editInBrowserMarkupPromise
const contextPath = '/manage-prototype'
const managementLinks = [
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
  },
  {
    name: 'Back to your prototype',
    url: '/'
  }
]

const getNavLinks = (req, linksObj, partToCompare) => {
  const relevantPart = req.originalUrl.split('/')[partToCompare]

  function isCurrentPage (link) {
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
      return link.alternativeUrlsInSection.some(altUrl => isCurrentPage({ url: altUrl }))
    }
    return false
  }

  return linksObj.map(link => ({
    ...link,
    isCurrentPage: isCurrentPage(link)
  }))
}

const getPageNavLinks = (req) => {
  return getNavLinks(req, managementLinks, 2)
}

function getManagementView (filename) {
  return [filename].join('/')
}

function warmUpReloaderScript () {
  reloaderScriptPromise = fsp.readFile(path.join(__dirname, 'assets', 'scripts', 'reloader-client.js'), 'utf8').then(x => `(() => {${x}})()`)
}

async function getReloaderScript () {
  if (!reloaderScriptPromise) {
    warmUpReloaderScript()
  }

  return (await reloaderScriptPromise).replace('__DATE__', new Date().getTime())
}

function warmUpEditInBrowserMarkup () {
  editInBrowserMarkupPromise = Promise.all([
    fsp.readFile(path.join(__dirname, 'assets', 'html', 'edit-in-browser.html'), 'utf8'),
    fsp.readFile(path.join(__dirname, 'assets', 'scripts', 'set-edit-in-browser-vars.js'), 'utf8')
  ])
    .then(([html, js]) => `<link rel="stylesheet" href="/manage-prototype/assets/edit-in-browser/main-include.css">${html}<script>${js}</script><script src="/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs/loader.js"></script><script src="/manage-prototype/assets/edit-in-browser/main-include.js"></script>`)
}

async function getEditInBrowserMarkup () {
  if (!editInBrowserMarkupPromise) {
    warmUpEditInBrowserMarkup()
  }

  return await editInBrowserMarkupPromise
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
  managementLinks,
  getManagementView,
  getReloaderScript,
  warmUpReloaderScript,
  getEditInBrowserMarkup,
  warmUpEditInBrowserMarkup,
  pluginLogger,
  getPageNavLinks,
  getNavLinks,
  awaitOrResolveWithDefault
}
