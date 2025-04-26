if (global.logTimeFromStart) {
  const callerLine = new Error().stack.split('\n').filter(x => x.includes('nowprototypeit'))[1]
  if (!callerLine) {
    global.logTimeFromStart('utils-loading (unknown)')
  } else {
    const caller = callerLine.split('(')[1].split(')')[0]
    global.logTimeFromStart(`utils-loading (${caller})`)
  }
}

// core dependencies
const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const { existsSync } = require('fs')

// npm dependencies
const inquirer = require('inquirer')
const portScanner = require('portscanner')
const { marked } = require('marked')

// local dependencies
const config = require('../config').getConfig()
const { appDir } = require('./paths')
const { asyncSeriesMap } = require('./asyncSeriesMap')
const utilsForServer = require('./utilsForServer')

// Tweak the Markdown renderer
const defaultMarkedRenderer = marked.defaults.renderer || new marked.Renderer()

marked.use({
  renderer: {
    code (code, infostring, escaped) {
      let rawHtml = defaultMarkedRenderer.code(code, infostring, escaped)
      // Add a tabindex to the <pre> element, to allow keyboard focus / scrolling
      rawHtml = rawHtml.replace('<pre>', '<pre tabindex="0">')
      return rawHtml
    }
  }
})

function removeSlashIndexFromEnd (url) {
  if (!url.endsWith('/index')) {
    return url
  }
  const replacement = url.substring(0, url.lastIndexOf('/index'))
  return replacement === '' ? '/' : replacement
}

function isView (file) {
  return file.endsWith('.njk') || file.endsWith('.html') || (config.respectFileExtensions && file.endsWith('.md'))
}

function findPagesInUsersKit () {
  return recursiveDirectoryContentsSync(path.join(appDir, 'views'))
    .filter(file => isView(file))
    .map(file => ({
      name: file,
      url: '/' + file.replace(/\.(?:njk|html|md)$/, '').replaceAll(path.sep, '/')
    }))
    .filter(page => !page.url.startsWith('/layouts/') && !page.url.startsWith('/includes/'))
    .map(page => ({
      ...page,
      url: removeSlashIndexFromEnd(page.url, '/index')
    }))
    .map(obj => {
      const displayUrl = obj.url
      // if (displayUrl.endsWith('/index')) {
      //   displayUrl = displayUrl.substring(0, displayUrl.lastIndexOf('/index'))
      //   if (displayUrl === '') {
      //     displayUrl = '/'
      //   }
      // }
      return ({
        ...obj,
        name: displayUrl
      })
    })
}

// Find an available port to run the server on
function findAvailablePort (callback) {
  let port = config.port

  console.log('')

  // Check port is free, else offer to change
  portScanner.findAPortNotInUse(port, port + 50, '127.0.0.1', (error, availablePort) => {
    if (error) { throw error }
    if (port === availablePort) {
      // Port is free, return it via the callback
      callback(port)
    } else {
      // Port in use - offer to change to available port
      console.error('ERROR: Port ' + port + ' in use - you may have another prototype running.\n')

      // Ask user if they want to change port
      inquirer.prompt([{
        name: 'changePort',
        message: 'Change to an available port?',
        type: 'confirm'
      }]).then(answers => {
        if (answers.changePort) {
          // User answers yes
          port = availablePort

          console.log('Changed to port ' + port)
          console.log('')

          callback(port)
        } else {
          // User answers no - exit
          process.exit(0)
        }
      })
    }
  })
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntilFileExists (filename, timeout) {
  const fileExists = fs.existsSync(filename)
  if (!fileExists) {
    if (timeout > 0) {
      await sleep(Math.min(500, timeout))
      return waitUntilFileExists(filename, timeout - 500)
    } else {
      throw new Error(`File ${filename} does not exist`)
    }
  }
}

function sessionFileStoreQuietLogFn (message) {
  if (message.endsWith('Deleting expired sessions')) {
    // session-file-store logs every time it prunes files for expired sessions,
    // but this isn't useful for our users, so let's just swallow those messages
    return
  }

  // Handling case where a user has multiple prototypes in the same working directory by giving a more useful error message
  if (message.includes('ENOENT')) {
    console.error('Warning: Please use different working directories for your prototypes to avoid session clashes')
    return
  }
  console.log(message)
}

function recursiveDirectoryContentsSync (baseDir) {
  function goThroughDir (dir = '') {
    const fullPath = path.join(baseDir, dir)
    if (!existsSync(fullPath)) {
      return []
    }
    const dirContents = fs.readdirSync(fullPath)
    return dirContents.map(item => {
      const lstat = fs.lstatSync(path.join(fullPath, item))
      const isDir = lstat.isDirectory()
      const itemPath = path.join(dir, item)
      if (isDir) {
        return goThroughDir(itemPath)
      }
      return itemPath
    }).flat()
  }

  return goThroughDir()
}

async function searchAndReplaceFiles (dir, searchText, replaceText, extensions) {
  const files = await fsp.readdir(dir)
  const modifiedFiles = await asyncSeriesMap(files, async file => {
    const filePath = path.join(dir, file)
    const fileStat = await fsp.stat(filePath)

    if (fileStat.isDirectory()) {
      return await searchAndReplaceFiles(filePath, searchText, replaceText, extensions)
    } else if (extensions.some(extension => file.endsWith(extension))) {
      let fileContent = await fsp.readFile(filePath, 'utf8')
      if (fileContent.includes(searchText)) {
        fileContent = fileContent.replace(new RegExp(searchText, 'g'), replaceText)
        await fsp.writeFile(filePath, fileContent)
        return filePath
      }
    }
  })

  return modifiedFiles.flat().filter(Boolean)
}

function sortByObjectKey (key) {
  return function (a, b) {
    if (a[key] > b[key]) {
      return 1
    }
    if (b[key] > a[key]) {
      return -1
    }
    return 0
  }
}

function hasNewVersion (installedVersion, latestVersion) {
  if (!latestVersion) {
    return false
  }

  const matcher = /^(\d+)\.(\d+)\.(\d+)(.+)?/
  const [, installedMajor, installedMinor, installedPatch, installedSuffix] = installedVersion?.match(matcher) || []
  const [, latestMajor, latestMinor, latestPatch, latestSuffix] = latestVersion?.match(matcher) || []

  if (installedMajor < latestMajor) return true
  if (installedMajor > latestMajor) return false
  if (installedMinor < latestMinor) return true
  if (installedMinor > latestMinor) return false
  if (installedPatch < latestPatch) return true
  if (installedPatch > latestPatch) return false

  if (installedSuffix && latestSuffix) {
    return installedSuffix < latestSuffix
  }
  return !!installedSuffix
}

function runSequentially (fn) {
  let isRunning = false
  return async () => {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (isRunning) {
      await sleep(100)
    }
    isRunning = true
    await fn()
    isRunning = false
  }
}

function debounce (fn, maxFrequency = 1000) {
  let lastTimeCalled = -1
  let isWaiting = false
  return () => {
    if (isWaiting) {
      return
    }
    const datetime = new Date().getTime()
    const timeSinceLastRun = datetime - lastTimeCalled
    if (timeSinceLastRun > maxFrequency) {
      lastTimeCalled = datetime
      fn()
    } else {
      isWaiting = true
      const delay = maxFrequency - timeSinceLastRun
      setTimeout(() => {
        isWaiting = false
        lastTimeCalled = new Date().getTime()
        fn()
      }, delay)
    }
  }
}

function monitorEventLoop (appName = 'unknown') {
  // const scheduledMillis = 300
  // const maxAcceptableMillis = scheduledMillis + scheduledMillis * .05
  // let previousTime = Date.now()
  // setInterval(() => {
  //   const currentTime = Date.now()
  //   const actualMillis = currentTime - previousTime
  //   if (actualMillis > maxAcceptableMillis) {
  //     console.log(`Event loop running slow in app [${appName}], sheduled [${scheduledMillis}], actual [${actualMillis}]`)
  //   }
  //   previousTime = currentTime
  // }, scheduledMillis)
}

module.exports = {
  findAvailablePort,
  sleep,
  waitUntilFileExists,
  sessionFileStoreQuietLogFn,
  searchAndReplaceFiles,
  recursiveDirectoryContentsSync,
  sortByObjectKey,
  hasNewVersion,
  runSequentially,
  debounce,
  monitorEventLoop,
  findPagesInUsersKit,
  ...utilsForServer
}

if (global.logTimeFromStart) {
  global.logTimeFromStart('utils-loaded')
}
