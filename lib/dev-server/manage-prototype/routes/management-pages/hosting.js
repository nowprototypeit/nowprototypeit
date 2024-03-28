const http = require('node:http')
const https = require('node:https')
const fsp = require('node:fs').promises
const url = require('node:url')
const path = require('node:path')

const tar = require('tar')

const {getPageNavLinks} = require("../../utils");
const {projectDir} = require("../../../../utils/paths");
const {getConfig} = require("../../../../config");
const contextPath = '/manage-prototype'

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
    router.get('/hosting', (req, res) => {
      let originalUrl = req.originalUrl.split('?')[0];
      res.render('hosting', {
        headerSubNavItems: getPageNavLinks(req),
        currentSection: 'Settings',
        currentUrl: req.originalUrl,
        uploadPrototypeUrl: originalUrl + '/upload-prototype',
        splash: req.query.splash,
        redirectUrl: originalUrl,
        hostedUrl: req.query.url
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

function openUploadRequest(prototypeName) {
  const strUrl = `${getConfig().nowUserResearchItAPIBaseUrl}/v1/prototypes/upload?prototypeName=${encodeURIComponent(prototypeName)}`
  const parsedUrl = url.parse(strUrl)
  const protocol = parsedUrl.protocol === 'https' ? https : http
  let finishedRes, finishedRej
  const finishedPromise = new Promise((resolve, reject) => {
    finishedRes = resolve
    finishedRej = reject
  })

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/gzip'
    }
  };

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
