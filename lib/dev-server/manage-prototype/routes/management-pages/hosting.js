const http = require('node:http')
const https = require('node:https')
const fsp = require('node:fs').promises
const url = require('node:url')
const path = require('node:path')
const { Readable } = require('node:stream')
const kitVersion = require('../../../../../package.json').version

const tar = require('tar')

const { getPageNavLinks } = require('../../utils')
const { projectDir, tmpDir } = require('../../../../utils/paths')
const { getConfig } = require('../../../../config')
const bodyParser = require('body-parser')

const { prepareMessageFromApiAsHtml } = require('../../utils/prepare-messsages-from-api')
const contextPath = '/manage-prototype'
const sessionInfoFile = path.join(tmpDir, 'auth-sessions.json')

async function createTgz () {
  const include = ['app', 'package.json', 'package-lock.json']

  return tar.c({
    gzip: true,
    cwd: projectDir,
    prefix: 'project/'
  }, (await fsp.readdir(projectDir)).filter(f => include.includes(f)))
}

function lookupErrorSplash (errorSplash, splash) {
  if (errorSplash === 'kit-version-too-old') {
    return {
      title: 'Kit version too old',
      messageHtml: 'You need to <strong><a href="/manage-prototype/plugin/npm:nowprototypeit">update your kit to the latest version</a></strong> to use this feature.',
      hideLoginForm: true
    }
  }
  if (errorSplash === 'no-package-json') {
    return {
      title: 'No package.json found',
      message: 'A package.json file is required to upload a prototype. Please make sure your project has a package.json file and try again.'
    }
  }
  if (errorSplash === 'local-deps') {
    return {
      title: 'Local dependencies found',
      message: 'You cannot upload a prototype with local dependencies. Please remove any local dependencies from your package.json file and try again.'
    }
  }
  if (errorSplash === 'already-exists') {
    return {
      title: 'A prototype with that name already exists',
      message: 'Please choose a new name and try again.'
    }
  }
  if (errorSplash || splash === 'error') {
    return {
      title: 'An unknown error occurred',
      message: 'Please make sure you\'re connected to the internet and try again.'
    }
  }
}

async function lookupSuccessSplash (req) {
  const { splash, appName } = req.query

  const urlResult = await lookupUrlForPrototype((await getLatestSession()).token, appName)
  if (splash === 'success') {
    return {
      title: 'Prototype uploaded successfully',
      message: 'Your prototype has been uploaded successfully. You can view it at',
      actualUrl: `/manage-prototype/hosting/redirect-to-logged-in-url/hosted-prototype?appName=${encodeURIComponent(appName)}`,
      displayUrl: urlResult
    }
  }
}

async function lookupUrlForPrototype (sessionToken, appName) {
  if (!appName) {
    return appName
  }
  const url = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/session/${encodeURIComponent(sessionToken)}/prototype/${encodeURIComponent(appName)}/url`
  try {
    const response = await standardJsonGetRequest(url)
    if (response.statusCode !== 200) {
      return
    }
    return response.body.url
  } catch (e) {
    console.error('Failed to lookup prototype URL', e)
  }
}

async function lookupHostingConfig () {
  const url = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/hosting-config-for-nowprototypeit/${encodeURIComponent(kitVersion)}`
  const defaultFailure = {
    isCompatible: false,
    messageFormattedText: 'Failed to load, please make sure you have a reliable internet connection.'
  }
  try {
    const response = await standardJsonGetRequest(url)
    if (response.statusCode !== 200) {
      return defaultFailure
    }
    return response.body
  } catch (e) {
    console.error('Failed to lookup prototype URL', e)
    return defaultFailure
  }
}

function preparePrototypeListForModel (prototypeList) {
  return (prototypeList || []).map(prototype => ({
    ...prototype
  }))
}

module.exports = {
  setupHostingPages: (router, config) => {
    router.get('/hosting/spinner.css', (req, res) => {
      res.sendFile(path.resolve(__dirname, '..', '..', 'assets', 'css', 'spinner.css'))
    })
    router.get('/hosting', async (req, res) => {
      const hostingConfig = await lookupHostingConfig()
      if (!hostingConfig.isCompatible) {
        return res.render('hosting-error', {
          headerSubNavItems: getPageNavLinks(req),
          message: prepareMessageFromApiAsHtml(hostingConfig.messageFormattedText)
        })
      }
      const originalUrl = req.originalUrl.split('?')[0]
      const sessionValidationResponse = await validateLatestSession(true)
      if (sessionValidationResponse) {
        const links = {
          items: sessionValidationResponse.links?.map(link => ({
            url: contextPath + '/hosting/redirect-to-logged-in-url/' + encodeURIComponent(link.type),
            name: link.text,
            newTab: true
          })),
          listClasses: 'user-profile-nav',
          itemClasses: 'user-profile-nav__item'
        }

        return res.render('hosting-logged-in', {
          headerSubNavItems: getPageNavLinks(req),
          currentUrl: req.originalUrl,
          uploadPrototypeUrl: originalUrl + '/upload-prototype',
          errorSplash: lookupErrorSplash(req.query['error-splash'], req.query.error),
          successSplash: await lookupSuccessSplash(req),
          redirectUrl: originalUrl,
          hostedUrl: req.query.url,
          email: sessionValidationResponse.email,
          name: sessionValidationResponse.name,
          links,
          userCanUpload: sessionValidationResponse.userCanUpload,
          uploadedCount: sessionValidationResponse.uploadedCount,
          uploadCapacity: sessionValidationResponse.uploadCapacity,
          prototypes: preparePrototypeListForModel(sessionValidationResponse.uploadedPrototypes)
        })
      }
      res.render('hosting-logged-out', {
        headerSubNavItems: getPageNavLinks(req),
        errorSplash: lookupErrorSplash(req.query['error-splash'], req.query.error),
        currentUrl: req.originalUrl,
        redirectUrl: originalUrl,
        loggedOutMessage: hostingConfig.loggedOutMessage
      })
    })
    function getLoginType (req) {
      if (!req.body || typeof req.body !== 'object') {
        return 'no body'
      }
      const keys = Object.keys(req.body)
      if (keys.includes('login')) {
        return 'login'
      }
      if (keys.includes('create-account')) {
        return 'create-account'
      }
      return 'no matching type - ' + JSON.stringify(req.body)
    }
    router.post('/hosting/begin-login', bodyParser.urlencoded({ extended: true }), async (req, res) => {
      const loginType = getLoginType(req)
      try {
        const url = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/begin`
        const result = await standardJsonPostRequest(url, {
          kitVersion,
          loginType
        })
        if (result.body && result.body.errorType === 'kit-version-too-old') {
          let url = `${contextPath}/hosting?error-splash=kit-version-too-old`
          if (result.body.oldestAcceptableKitVersion) {
            url += `&oldestAcceptable=${encodeURIComponent(result.body.oldestAcceptableKitVersion)}`
          }
          return res.redirect(302, url)
        }
        if (result.body && result.body.error) {
          console.log('error beginning login', result.body.error)
          return res.redirect(302, `${contextPath}/hosting?error=generic`)
        }
        const id = await addNewSession({ ...result.body, status: 'needs-opening' })
        res.redirect(contextPath + '/hosting/external-login?id=' + encodeURIComponent(id))
      } catch (e) {
        console.error('Failed to begin login', e)
        return res.render('error', {
          message: 'Something went wrong while trying to log you in, please check your internet connection and try again.'
        })
      }
    })
    router.get('/hosting/external-login', async (req, res, next) => {
      const id = req.query.id
      const outputType = req.query.outputType === 'json' ? 'json' : 'html'
      const sessionInfo = await lookupSession(id)
      const hostingUrl = `${contextPath}/hosting`
      if (!sessionInfo) {
        if (outputType === 'json') {
          return res.json(({ started: false, completed: false, abandoned: true, redirectToUrl: hostingUrl }))
        }
        return res.redirect(302, hostingUrl)
      }
      const shouldAutoOpen = sessionInfo.status === 'needs-opening'
      const loginUrl = sessionInfo.userJourneyEntryPoint
      if (shouldAutoOpen) {
        await updateSession(id, { ...sessionInfo, status: 'opened' })
      }
      try {
        const apiStatus = await standardJsonPostRequest(sessionInfo.statusEndpoint)
        if (apiStatus.body.token) {
          await updateSession(id, { ...sessionInfo, status: 'logged-in', token: apiStatus.body.token })
          if (outputType === 'json') {
            return res.json(({ started: true, completed: true, redirectToUrl: hostingUrl }))
          }
          return res.redirect(302, hostingUrl)
        }
        if (apiStatus.body.phase > 1) {
          if (outputType === 'json') {
            return res.json(({ started: true, completed: false }))
          }
          return res.render('hosting-logging-in', {
            headerSubNavItems: getPageNavLinks(req)
          })
        }
        if (apiStatus.exists === false) {
          await clearSessions()
          if (outputType === 'json') {
            return res.json(({ started: false, completed: false, abandoned: true, redirectToUrl: hostingUrl }))
          }
          return res.redirect(302, `${contextPath}/hosting?error-splash=generic`)
        }
        if (outputType === 'json') {
          return res.json(({ started: false, completed: false }))
        }
        res.render('hosting-logging-in', {
          headerSubNavItems: getPageNavLinks(req),
          id,
          shouldAutoOpen,
          loginUrl,
          checkForUpdatesUrl: JSON.stringify(req.originalUrl + '&outputType=json')
        })
      } catch (e) {
        console.log('problem with request (c)', e)
        res.render('error', {
          message: 'Something went wrong while trying to log you in, please check your internet connection and try again.'
        })
      }
    })
    const numberofAjaxProgressRetries = 5
    let remainingAjaxProgressRetries = numberofAjaxProgressRetries
    router.post('/hosting/upload-prototype', bodyParser.urlencoded({ extended: true }), async (req, res) => {
      const prototypeName = req.body['prototype-name']
      remainingAjaxProgressRetries = numberofAjaxProgressRetries

      const [packageJsonContents, hostingPlatformBasePlatform] = await Promise.all([
        fsp.readFile(path.join(projectDir, 'package.json'), 'utf8').then(JSON.parse).catch(() => null),
        lookupHostingConfig().then((response) => response.hostingBaseUrl)
      ])

      if (!packageJsonContents) {
        res.redirect(contextPath + '/hosting?error-splash=no-package-json')
        return
      }
      if (Object.values(packageJsonContents.dependencies).some(x => x.startsWith('file:'))) {
        console.error('Cannot upload prototype with local dependencies')
        res.redirect(contextPath + '/hosting?error-splash=local-deps')
        return
      }

      const uploadToken = await requestUploadToken({ prototypeName, packageJsonContents })

      if (!uploadToken) {
        console.error('Failed to request upload token')
        res.redirect(contextPath + '/hosting?error-splash=upload-token')
        return
      }

      try {
        const { finishedPromise, apiReq } = openUploadRequest(uploadToken, hostingPlatformBasePlatform)
        const tgz = await createTgz()
        tgz.pipe(apiReq)

        const result = await finishedPromise

        if (result.statusCode !== 200) {
          console.log('error uploading prototype', result.body)
          return res.redirect(contextPath + '/hosting?error-splash=' + encodeURIComponent(result.body?.error || 'generic'))
        }

        res.redirect(contextPath + '/hosting/upload-progress?statusId=' + encodeURIComponent(result.body.statusId))
      } catch (e) {
        console.error('Failed to generate file to upload.')
        console.error(e)
        res.redirect(contextPath + '/hosting?error-splash=generic')
      }
    })
    router.get('/hosting/upload-progress-ajax', async (req, res) => {
      const result = await getPrototypeUploadStatus(req.query.statusId)
      if (!result) {
        remainingAjaxProgressRetries--
        console.log('No progress reported yet, ' + remainingAjaxProgressRetries + ' more retries.')
        if (remainingAjaxProgressRetries <= 0) {
          return res.json({ uploadFailed: true, reason: 'hello' })
        } else {
          return res.json({ message: `No progress reported yet, ${remainingAjaxProgressRetries} more retries.` })
        }
      }
      remainingAjaxProgressRetries = numberofAjaxProgressRetries
      if (result.appIsReady && result.prototypeNameWithSuffix) {
        return res.send({
          appIsReady: true,
          prototypeName: result.prototypeNameWithSuffix
        })
      }
      res.send(result)
    })
    router.get('/hosting/upload-progress', (req, res) => {
      res.render('hosting-upload-progress', {
        statusId: req.query.statusId
      })
    })
    router.post('/hosting/logout', async (req, res) => {
      const sessionValidationResponse = await validateLatestSession()
      if (sessionValidationResponse) {
        const response = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}${sessionValidationResponse.signOutUrl}`, {})
        if (response.statusCode !== 200) {
          console.error('Failed to log out server side', response.body)
        }
      }
      res.redirect(302, '/manage-prototype')
      clearSessions()
    })
    router.get('/hosting/profile-picture', async (req, res) => {
      const sessionValidationResponse = await validateLatestSession()
      if (sessionValidationResponse) {
        const url = `${getConfig().nowPrototypeItAPIBaseUrl}${sessionValidationResponse.image}`

        const response = await fetch(url)
        Readable.fromWeb(response.body).pipe(res)
      } else {
        res.status(403).send('Not logged in')
      }
    })
    router.get('/hosting/redirect-to-logged-in-url/:type', async (req, res, next) => {
      const latestSession = await getLatestSession()
      const appName = req.query.appName
      if (!latestSession) {
        next(new Error('You must log in to access this content'))
      }
      const result = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/create-logged-in-link`, {
        type: req.params.type,
        token: latestSession.token,
        appName
      })
      const link = result?.body?.link
      if (link) {
        res.redirect(link)
      } else {
        next()
      }
    })
  }
}

function getProtocolAndOptionsForRequest (strUrl, method, contentType = null) {
  const parsedUrl = url.parse(strUrl)
  const protocol = parsedUrl.protocol === 'https:' ? https : http

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method,
    headers: {
      Host: parsedUrl.host,
      'X-Kit-Version': kitVersion
    }
  }
  if (contentType) {
    options.headers['Content-Type'] = contentType
  }
  return { protocol, options }
}

function standardJsonGetRequest (strUrl) {
  const { protocol, options } = getProtocolAndOptionsForRequest(strUrl, 'GET')

  return new Promise((resolve, reject) => {
    const apiReq = protocol.request(options, getJsonResponseCallback(reject, strUrl, resolve))

    apiReq.on('error', (error) => {
      console.error(`problem with request (a): ${error.message}`)
      resolve({ statusCode: 0, body: null, headers: {} })
    })

    apiReq.end()
  })
}

function getJsonResponseCallback (reject, strUrl, resolve) {
  return (res) => {
    let body = ''
    res.on('data', (chunk) => {
      body += chunk.toString()
    })
    res.on('end', () => {
      let jsonBodyObj
      try {
        jsonBodyObj = JSON.parse(body)
      } catch (e) {
        return reject(new Error(`Failed to parse JSON response from POST request to [${strUrl}] with body [${body}]`))
      }
      const result = {
        statusCode: res.statusCode,
        body: jsonBodyObj,
        headers: res.headers
      }
      resolve(result)
    })
  }
}

function standardJsonPostRequest (strUrl, bodyObj = {}) {
  const { protocol, options } = getProtocolAndOptionsForRequest(strUrl, 'POST', 'application/json')
  return new Promise((resolve, reject) => {
    const apiReq = protocol.request(options, getJsonResponseCallback(reject, strUrl, resolve))

    apiReq.on('error', (error) => {
      console.error(`problem with request (a): ${error.message}`)
      resolve({ statusCode: 0, body: null, headers: {} })
    })

    apiReq.write(JSON.stringify(bodyObj))
    apiReq.end()
  })
}

function openUploadRequest (uploadToken, hostingPlatformBaseUrl) {
  const strUrl = `${hostingPlatformBaseUrl}/v1/prototypes/upload?&uploadToken=${encodeURIComponent(uploadToken)}`
  const contentType = 'application/gzip'
  const method = 'POST'
  const { protocol, options } = getProtocolAndOptionsForRequest(strUrl, method, contentType)
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })

  const apiReq = protocol.request(options, (res) => {
    let body = ''
    res.on('data', (chunk) => {
      body += chunk.toString()
    })
    res.on('end', () => {
      try {
        body = JSON.parse(body)
      } catch (e) {
        console.error(`Failed to parse JSON response from POST request to [${strUrl}], [${body}]`)
      }
      finishedRes({
        statusCode: res.statusCode,
        body,
        headers: res.headers
      })
    })
  })

  apiReq.on('error', (error) => {
    console.error(`problem with request (b): ${error.message}`)
    finishedRej(error)
  })

  return {
    finishedPromise,
    apiReq
  }
}

async function addNewSession (info) {
  const sessions = {}
  const id = Date.now() + '-' + ('' + Math.random()).split('.')[1]
  sessions[id] = info
  await fsp.writeFile(sessionInfoFile, JSON.stringify(sessions, null, 2))
  return id
}

async function lookupSession (id) {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => ({}))
  return sessions[id]
}

async function getLatestSession () {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => ({}))
  return sessions[Object.keys(sessions || {}).sort().reverse()[0]]
}

async function updateSession (id, info) {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => ({}))
  sessions[id] = info
  await fsp.writeFile(sessionInfoFile, JSON.stringify(sessions, null, 2))
}

async function requestUploadToken (info) {
  const sessionInfo = await validateLatestSession()
  if (!sessionInfo) {
    console.error('No valid session found')
    return
  }
  if (!sessionInfo.uploadTokenUrl) {
    console.error('No upload token URL.')
    return
  }
  const result = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}${sessionInfo.uploadTokenUrl}`, {
    info
  })
  if (result.statusCode === 200) {
    return result.body.uploadToken
  }
}

async function clearSessions () {
  await fsp.writeFile(sessionInfoFile, '{}')
}

async function getPrototypeUploadStatus (statusId) {
  const sessionInfo = await validateLatestSession()
  if (!sessionInfo) {
    console.error('No valid session found')
    return
  }
  if (!sessionInfo.uploadStatusUrl) {
    console.error('No upload status URL.')
    return
  }
  const url = `${getConfig().nowPrototypeItAPIBaseUrl}${sessionInfo.uploadStatusUrl}?statusId=${encodeURIComponent(statusId)}`
  const result = await standardJsonGetRequest(url)
  return result.body
}

async function validateLatestSession (expanded = false) {
  const sessionInfo = await getLatestSession()
  const queryString = expanded ? '?includePrototypeSummary=true&includeLinks=true' : ''
  if (sessionInfo && sessionInfo.status === 'logged-in' && sessionInfo.token) {
    try {
      const strUrl = `${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/validate-session${queryString}`
      const bodyObj = {
        token: sessionInfo.token
      }
      if (expanded) {
        bodyObj.includePrototypeSummary = true
        bodyObj.includeLinks = true
      }
      const result = await standardJsonPostRequest(strUrl, bodyObj)
      if (result.body && result.body.exists) {
        return result.body
      }
    } catch (e) {
      console.error('problem with request (c)', e)
    }
  }
}
