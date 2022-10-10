/* eslint-env jest */
const path = require('path')

const request = require('supertest')

const { mkdtempSync } = require('../util')
const testDir = path.join(mkdtempSync(), 'force-https-redirect')

/* Setup Environment Variables before setting App */
process.env.IS_INTEGRATION_TEST = 'true'
process.env.KIT_PROJECT_DIR = testDir
process.env.NODE_ENV = 'production'
process.env.USE_HTTPS = 'true'

const app = require('../../server.js')

describe('The Prototype Kit - force HTTPS redirect functionality', () => {
  describe('should in a production environment', () => {
    it('have HTTP header "location" field that begins with https', async () => {
      const response = await request(app).get('/')
      expect(response.header.location.startsWith('https://')).toBeTruthy()
    })

    it('redirect to the same HTTPS url', async () => {
      const response = await request(app).get('/')
      expect(response.header.location.endsWith('/')).toBeTruthy()
    })

    it('have HTTP header "status" field that indicates a redirect', async () => {
      const response = await request(app).get('/')
      expect(response.statusCode).toBe(302)
    })
  })
})
