if (global.isRunningAsPartOfFakeApiProcess) {
  const express = require('express')
  const authRouter = require('express').Router()

  let baseUrl = ''
  let sessionIdCount = 1000
  let statusIdCount = 2000
  let publicIdCount = 3000
  let sessionActionId = 4000

  const singleLoginConfiguredUsers = (process.env.NPI_FAKE_API__ACCEPTED_SINGLE_USE_USERNAMES || '').split(',').filter(x => x.trim().length > 0).map(username => ({ username, uploadCapacity: 3, uploadedCount: 0 }))
  const sessions = {}
  const statuses = {}
  const sessionsByPublicId = {}
  const sessionsByAccessId = {}

  console.log('starting single login usernames', singleLoginConfiguredUsers, process.pid)

  function setBaseUrlForAuthRouter (url) {
    baseUrl = url
  }

  function deleteAllTracesOfSessionWithToken (token) {
    Object.keys(sessions).filter(key => sessions[key].token === token).forEach(key => {
      delete sessionsByPublicId[sessions[key].publicId]
      delete sessionsByAccessId[sessions[key].__accessId__not_in_real_api]
      delete sessions[key]
    })
  }

  function resetAuth () {
    singleLoginConfiguredUsers.splice(0, singleLoginConfiguredUsers.length)
    Object.keys(sessions).forEach(key => {
      delete sessions[key]
    })
    Object.keys(statuses).forEach(key => {
      delete statuses[key]
    })
    Object.keys(sessions).forEach((session) => {
      deleteAllTracesOfSessionWithToken(session.token)
    })
  }

  authRouter.post('/v1/auth/begin', express.json(), (req, res) => {
    const statusId = `fake-status-id-${statusIdCount++}`
    statuses[statusId] = {
      exists: true,
      phase: 1

    }
    res.send({
      userJourneyEntryPoint: `${baseUrl}/__fake-website__/auth/login-begin?statusId=${encodeURIComponent(statusId)}`,
      statusEndpoint: `${baseUrl}/__fake__/status-endpoint?statusId=${encodeURIComponent(statusId)}`,
      apiId: statusId,
      webId: statusId
    })
  })

  authRouter.post('/v1/auth/validate-session', express.json(), (req, res) => {
    const token = req.body.token
    const session = sessions[token]
    res.send(session)
  })

  authRouter.get('/__fake__/profile-image/:publicId', (req, res) => {
    res.redirect('https://gravatar.com/images/homepage/avatar-01.png')
  })

  authRouter.post('/__fake__/sign-out/:sessionActionId', (req, res) => {
    console.log('sign-out request params', req.params)
    console.log('sign-out request headers', req.headers)
    const sessionActionId = req.params.sessionActionId
    if (sessionsByAccessId[sessionActionId]) {
      const session = sessionsByAccessId[sessionActionId]
      deleteAllTracesOfSessionWithToken(session.token)
      return res.send({
        success: true
      })
    }
    res.status(401).send({
      success: false,
      error: 'not logged in'
    })
  })

  authRouter.post('/__fake__/status-endpoint', (req, res) => {
    const statusId = req.query.statusId
    const status = statuses[statusId]
    if (!status) {
      console.error('No status found for ID', statusId)
      return res.status(404).send({
        error: 'status not found'
      })
    }
    res.send(status)
  })

  authRouter.get('/__fake-website__/auth/login-begin', (req, res) => {
    const statusId = req.query.statusId
    res.send(`<!DOCTYPE html>

<form method="POST" action="/__fake-website__/auth/login-continue">
<div>
<input type="hidden" name="statusId" value="${statusId}">
<label for="username">Username</label>
<input type="text" name="username" id="username">
</div>
<div>
<button type="submit">Attempt login</button>
</div>
</form>`)
  })

  authRouter.post('/__fake-website__/auth/login-continue', express.urlencoded({ extended: true }), (req, res) => {
    const username = req.body.username
    const statusId = req.body.statusId
    if (username && statusId && statuses[statusId]) {
      const userIndex = singleLoginConfiguredUsers.findIndex(user => {
        return user.username === username
      })
      if (userIndex > -1) {
        const user = singleLoginConfiguredUsers[userIndex]
        statuses[statusId].phase = 2
        statuses[statusId].__username__not_in_real_api = user.username
        statuses[statusId].__uploadCapacity__not_in_real_api = user.uploadCapacity
        statuses[statusId].__uploadedCount__not_in_real_api = user.uploadedCount
        singleLoginConfiguredUsers.splice(userIndex, 1)
        return res.send(`<!DOCTYPE html>

<form method="POST" action="/__fake-website__/auth/login-continue-otp">
<div>
<input type="hidden" name="statusId" value="${statusId}">
<label for="otp">One time password (hint, it's always 1234 on this fake version)</label>
<input type="text" name="otp" id="otp">
</div>
<div>
<button type="submit">Send OTP</button>
</div>
</form>`)
      } else {
        return res.redirect('/__fake-website__/auth/login-begin?error=username-not-found')
      }
    }
    console.error('Condition failed in fake auth', !!username, !!statusId, !!statuses[statusId])

    res.send(`<!DOCTYPE html>

<h1>Something went wrong</h1>`)
  })

  authRouter.post('/__fake-website__/auth/login-continue-otp', express.urlencoded({ extended: true }), (req, res) => {
    const otp = req.body.otp
    const statusId = req.body.statusId
    if (otp === '1234') {
      const statusObj = statuses[statusId]
      if (!statusObj) {
        console.error('No status found for ID', statusId)
        return res.status(404).send({
          error: 'status not found'
        })
      }
      statusObj.token = `fake-token-${sessionIdCount++}`
      statusObj.phase = 3

      const fakePublicId = `fake-public-id-${publicIdCount++}`
      const fakeSessionActionId = `fake-session-action-id-${sessionActionId++}`
      const username = statusObj.__username__not_in_real_api || 'No username found'
      const uploadCapacity = statusObj.__uploadCapacity__not_in_real_api || 0
      const uploadedCount = statusObj.__uploadedCount__not_in_real_api || 0
      sessions[statusObj.token] = {
        exists: true,
        name: username,
        publicId: fakePublicId,
        image: `/__fake__/profile-image/${encodeURIComponent(fakePublicId)}`,
        signOutUrl: `/__fake__/sign-out/${encodeURIComponent(fakeSessionActionId)}`,
        uploadTokenUrl: `/__fake__/retrieve-upload-token/${encodeURIComponent(fakeSessionActionId)}`,
        uploadStatusUrl: `/__fake__/upload-status/${encodeURIComponent(fakeSessionActionId)}`,
        uploadCapacity,
        uploadedCount,
        userCanUpload: uploadCapacity > 0,
        uploadedPrototypes: [],
        __accessId__not_in_real_api: fakeSessionActionId,
        links: [
          {
            text: 'Your account',
            type: 'account'
          },
          {
            text: 'Your uploaded prototypes',
            type: 'uploaded-prototypes'
          }
        ]
      }
      sessionsByAccessId[fakeSessionActionId] = sessions[statusObj.token]
      sessionsByPublicId[fakePublicId] = sessions[statusObj.token]
      return res.send('<!DOCTYPE html><h1>Login complete</h1>')
    }
    console.log('wrong OTP (should be 1234)', otp)
    return res.redirect('/__fake-website__/auth/login-continue-otp?wrong-top=true')
  })

  authRouter.post('/__fake__/allow-single-login', express.json(), (req, res) => {
    console.log('allow single login', req.body)
    if (req.body && req.body.username) {
      singleLoginConfiguredUsers.push(req.body)
      return res.send({
        success: true
      })
    }
    res.status(400).send({
      success: false,
      error: 'missing body key username'
    })
  })

  authRouter.post('/__fake__/retrieve-upload-token/:sessionActionId', express.json(), (req, res) => {
    console.log('retrieve upload token request body', req.body)
    res.send({
      uploadToken: `fake-upload-token-${req.params.sessionActionId}`
    })
  })

  module.exports = {
    resetAuth,
    authRouter,
    setBaseUrlForAuthRouter
  }
}
