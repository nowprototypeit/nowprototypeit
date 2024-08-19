const http = require('node:http')
const https = require('node:https')
const fsp = require('node:fs').promises
const url = require('node:url')
const path = require('node:path')

const tar = require('tar')

const {getPageNavLinks} = require("../../utils");
const {projectDir, tmpDir} = require("../../../../utils/paths");
const {getConfig} = require("../../../../config");
const contextPath = '/manage-prototype'
const sessionInfoFile = path.join(tmpDir, 'auth-sessions.json')

async function createTgz() {
  const ignore = ['.tmp', 'node_modules', '.git', '.gitignore']
  const include = ['app', 'package.json', 'package-lock.json']

  return tar.c({
    gzip: true,
    cwd: projectDir,
    prefix: 'project/'
  }, (await fsp.readdir(projectDir)).filter(f => include.includes(f)))
}

module.exports = {
  setupHostingPages: (router, config) => {
    router.get('/hosting-logged-in', (req, res) => {
      let originalUrl = req.originalUrl.split('?')[0];
      res.render('hosting-logged-in', {
        headerSubNavItems: getPageNavLinks(req),
        currentUrl: req.originalUrl,
        uploadPrototypeUrl: originalUrl + '/upload-prototype',
        splash: req.query.splash,
        redirectUrl: originalUrl,
        hostedUrl: req.query.url
      })
    })
    router.get('/hosting', (req, res) => {
      let originalUrl = req.originalUrl.split('?')[0];
      res.render('hosting-logged-out', {
        headerSubNavItems: getPageNavLinks(req),
        currentUrl: req.originalUrl,
        uploadPrototypeUrl: originalUrl + '/upload-prototype',
        splash: req.query.splash,
        redirectUrl: originalUrl,
        hostedUrl: req.query.url
      })
    })
    router.post('/hosting/begin-login', async (req, res) => {
      const result = await standardJsonPostRequest(`${getConfig().nowPrototypeItAPIBaseUrl}/v1/auth/begin`, {kitVersion: '0.3.0'})
      const id = await addNewSession({...result.body, status: 'needs-opening'})
      res.redirect(contextPath + '/hosting/external-login?id=' + encodeURIComponent(id))
    })
    router.get('/hosting/external-login', async (req, res) => {
      const id = req.query.id;
      const sessionInfo = await lookupSession(id)
      console.log('session info', sessionInfo)
      const shouldAutoOpen = sessionInfo.status === 'needs-opening'
      const loginUrl = sessionInfo.userJourneyEntryPoint
      if (shouldAutoOpen) {
        await updateSession(id, {...sessionInfo, status: 'opened'})
      }
      const apiStatus = await standardJsonPostRequest(sessionInfo.statusEndpoint)
      console.log('api status', apiStatus.body)
      if (apiStatus.body.token) {
        await updateSession(id, {...sessionInfo, status: 'logged-in', token: apiStatus.body.token})
        return res.redirect(contextPath + '/hosting-logged-in')
      }
      if (apiStatus.body.phase > 1) {
        return res.render('hosting-logging-in', {
          headerSubNavItems: getPageNavLinks(req)
        })
      }
      res.render('hosting-logging-in', {
        headerSubNavItems: getPageNavLinks(req),
        id,
        shouldAutoOpen,
        loginUrl
      })
    })
    router.post('/hosting/upload-prototype', async (req, res) => {
      const prototypeName = req.body['prototype-name']

      let packageJsonContents = await fsp.readFile(path.join(projectDir, 'package.json'), 'utf8').then(JSON.parse).catch(() => null)

      if (!packageJsonContents) {
        res.redirect(contextPath + '/hosting?splash=error-no-package-json')
        return
      }
      if (Object.values(packageJsonContents.dependencies).some(x => x.startsWith('file:'))) {
        console.error('Cannot upload prototype with local dependencies')
        res.redirect(contextPath + '/hosting?splash=error-local-deps')
        return
      }

      try {
        const { finishedPromise, apiReq } = openUploadRequest(prototypeName)
        const tgz = await createTgz()
        tgz.pipe(apiReq)

        const result = await finishedPromise

        console.log('Upload result:', result)

        res.redirect(contextPath + '/hosting?splash=success&url=' + encodeURIComponent(result.url))

      } catch (e) {
        console.error('Failed to generate file to upload.')
        console.error(e)
        res.redirect(contextPath + '/hosting?splash=error')
      }
    })
  }
}

function getProtocolAndOptionsForRequest(strUrl, method, contentType) {
  const parsedUrl = url.parse(strUrl)
  const protocol = parsedUrl.protocol === 'https' ? https : http

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method,
    headers: {
      'Content-Type': contentType
    }
  };
  return {protocol, options};
}

function standardJsonPostRequest(strUrl, bodyObj = {}) {
  const {protocol, options} = getProtocolAndOptionsForRequest(strUrl, 'POST', 'application/json')
  return new Promise((resolve, reject) => {
    const apiReq = protocol.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk.toString('utf8')
      });
      res.on('end', () => {
        let jsonBodyObj
        try {
          jsonBodyObj = JSON.parse(body)
        } catch (e) {
          console.error('Failed to parse JSON response:', e)
          console.error('Request URL was:', strUrl)
          console.error('Response body was:', body)
          return reject(new Error('Failed to parse JSON response'))
        }
        resolve({
          statusCode: res.statusCode,
          body: jsonBodyObj,
          headers: res.headers
        })
      })
    });

    apiReq.on('error', (error) => {
      console.error(`problem with request: ${error.message}`);
      reject(error)
    });

    apiReq.write(JSON.stringify(bodyObj))
    apiReq.end()
  })
}

function openUploadRequest(prototypeName) {
  const strUrl = `${getConfig().nowUserResearchItAPIBaseUrl}/v1/prototypes/upload?prototypeName=${encodeURIComponent(prototypeName)}`
  const contentType = 'application/gzip';
  const method = 'POST';
  const {protocol, options} = getProtocolAndOptionsForRequest(strUrl, method, contentType);
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })

  console.log('options', options)

  const apiReq = protocol.request(options, (res) => {
    let body = ''
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', (chunk) => {
      body += chunk.toString('utf8')
    });
    res.on('end', () => {
      finishedRes({
        statusCode: res.statusCode,
        body: body,
        headers: res.headers
      })
    })
  });

  apiReq.on('error', (error) => {
    console.error(`problem with request: ${error.message}`);
    finishedRej(error)
  });

  return {
    finishedPromise,
    apiReq
  }
}

async function addNewSession(info) {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => ({}))
  const id = Date.now + '-' + ('' + Math.random()).split('.')[1]
  sessions[id] = info
  await fsp.writeFile(sessionInfoFile, JSON.stringify(sessions, null, 2))
  return id
}

async function lookupSession(id) {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => {})
  return sessions[id]
}

async function updateSession(id, info) {
  const sessions = await fsp.readFile(sessionInfoFile, 'utf8').then(JSON.parse).catch(() => {})
  sessions[id] = info
  await fsp.writeFile(sessionInfoFile, JSON.stringify(sessions, null, 2))
}
