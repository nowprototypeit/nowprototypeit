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
  if (splash === 'error' || errorSplash === 'generic') {
    return {
      title: 'An unknown error occurred',
      message: 'Please make sure you\'re connected to the internet and try again.'
    }
  }
}

function lookupSuccessSplash (splash, url) {
  if (splash === 'success') {
    return {
      title: 'Prototype uploaded successfully',
      message: 'Your prototype has been uploaded successfully. You can view it at',
      url
    }
  }
}

module.exports = {
  setupHostingPages: (router, config) => {
    router.get('/hosting', async (req, res) => {
      const originalUrl = req.originalUrl.split('?')[0]
      const sessionValidationResponse = await validateLatestSession()
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
          successSplash: lookupSuccessSplash(req.query.splash, req.query.url),
          redirectUrl: originalUrl,
          hostedUrl: req.query.url,
          email: sessionValidationResponse.email,
          name: sessionValidationResponse.name,
          links
        })
      }
      res.render('hosting-logged-out', {
        headerSubNavItems: getPageNavLinks(req),
        currentUrl: req.originalUrl,
        genericError: req.query.error === 'generic',
        redirectUrl: originalUrl
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
        if (result.body.error) {
          console.log('error beginning login', result.error)
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
    router.post('/hosting/upload-prototype', bodyParser.urlencoded({ extended: true }), async (req, res) => {
      const prototypeName = req.body['prototype-name']

      const packageJsonContents = await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8').then(JSON.parse).catch(() => null)

      if (!packageJsonContents) {
        res.redirect(contextPath + '/hosting?error-splash=no-package-json')
        return
      }
      if (Object.values(packageJsonContents.dependencies).some(x => x.startsWith('file:'))) {
        console.error('Cannot upload prototype with local dependencies')
        res.redirect(contextPath + '/hosting?error-splash=local-deps')
        return
      }

      const uploadToken = await requestUploadToken({ prototypeName })

      if (!uploadToken) {
        console.error('Failed to request upload token')
        res.redirect(contextPath + '/hosting?error-splash=upload-token')
        return
      }

      try {
        const { finishedPromise, apiReq } = openUploadRequest(uploadToken)
        const tgz = await createTgz()
        tgz.pipe(apiReq)

        const result = await finishedPromise

        if (result.statusCode !== 200) {
          return res.redirect(contextPath + '/hosting?error-splash=' + encodeURIComponent(result.body?.error || 'generic'))
        }

        res.redirect(contextPath + '/hosting?splash=success&url=' + encodeURIComponent(result.body.url))
      } catch (e) {
        console.error('Failed to generate file to upload.')
        console.error(e)
        res.redirect(contextPath + '/hosting?error-splash=generic')
      }
    })
    router.post('/hosting/logout', async (req, res) => {
      const sessionValidationResponse = await validateLatestSession()
      if (sessionValidationResponse) {
        const response = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}${sessionValidationResponse.signOutUrl}`, {})
        console.log('sign out response', response.body)
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
      if (!latestSession) {
        next(new Error('You must log in to access this content'))
      }
      console.log('latest session', latestSession)
      const result = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/create-logged-in-link`, {
        type: req.params.type,
        token: latestSession.token
      })
      console.log('result', result)
      const link = result?.body?.link
      if (link) {
        console.log('redirecting to', link)
        res.redirect(link)
      } else {
        console.log('link type not found')
        next()
      }
    })
  }
}

function getProtocolAndOptionsForRequest (strUrl, method, contentType) {
  const parsedUrl = url.parse(strUrl)
  const protocol = parsedUrl.protocol === 'https:' ? https : http

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method,
    headers: {
      'Content-Type': contentType,
      Host: parsedUrl.host,
      'X-Kit-Version': kitVersion
    }
  }
  return { protocol, options }
}

function standardJsonPostRequest (strUrl, bodyObj = {}) {
  const { protocol, options } = getProtocolAndOptionsForRequest(strUrl, 'POST', 'application/json')
  return new Promise((resolve, reject) => {
    const apiReq = protocol.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk.toString('utf8')
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
    })

    apiReq.on('error', (error) => {
      console.error(`problem with request (a): ${error.message}`)
      resolve({ statusCode: 0, body: null, headers: {} })
    })

    apiReq.write(JSON.stringify(bodyObj))
    apiReq.end()
  })
}

function openUploadRequest (uploadToken) {
  const strUrl = `${getConfig().nowUserResearchItAPIBaseUrl}/v1/prototypes/upload?&uploadToken=${encodeURIComponent(uploadToken)}`
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
      body += chunk.toString('utf8')
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
  return sessions[Object.keys(sessions || {}).sort().toReversed()[0]]
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
    const token = result.body.uploadToken
    return token
  }
}

async function clearSessions () {
  await fsp.writeFile(sessionInfoFile, '{}')
}

async function validateLatestSession () {
  const sessionInfo = await getLatestSession()
  if (sessionInfo && sessionInfo.status === 'logged-in' && sessionInfo.token) {
    try {
      const result = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/validate-session`, {
        token: sessionInfo.token
      })
      if (result.body.exists) {
        return result.body
      }
    } catch (e) {
      console.error('problem with request (c)', e)
    }
  }
}
