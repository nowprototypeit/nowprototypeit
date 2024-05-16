const fsp = require('node:fs/promises')
const path = require('node:path')

const bodyParser = require('body-parser')
const express = require('express')

const { projectDir, packageDir } = require('../../../utils/paths')
const { getConfig } = require('../../../config')

const jsonBodyParser = bodyParser.json()

module.exports = {
  editInBrowser: (app, config) => {
    if (!getConfig().editInBrowser) {
      return
    }
    app.use('/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs', express.static(path.join(packageDir, 'node_modules', 'monaco-editor', 'min', 'vs')))
    app.use('/manage-prototype/assets/edit-in-browser/main-include.js', express.static(path.join(packageDir, 'lib', 'dev-server', 'manage-prototype', 'assets', 'scripts', 'edit-in-browser.js')))
    app.use('/manage-prototype/assets/edit-in-browser/main-include.css', express.static(path.join(packageDir, 'lib', 'dev-server', 'manage-prototype', 'assets', 'css', 'edit-in-browser.css')))
    app.get('/manage-prototype/edit-in-browser/file-contents', async (req, res) => {
      const {relativeFilePath} = req.query
      const absolutePath = path.join(projectDir, relativeFilePath)
      try {
        const fileContents = await fsp.readFile(absolutePath, 'utf8')
        res.send({
          fileContents
        })
      } catch (e) {
        console.error('Error occurred while loading file for in-browser editing', e)
        res.send({
          error: true
        })
      }
    })
    app.put('/manage-prototype/edit-in-browser/file-contents', [jsonBodyParser], async (req, res) => {
      const {relativeFilePath} = req.query
      const {fileContents} = req.body
      const absolutePath = path.join(projectDir, relativeFilePath)
      try {
        await fsp.writeFile(absolutePath, fileContents, 'utf8')
        res.send({
          success: true
        })
      } catch (e) {
        console.error('Error occurred while loading file for in-browser editing', e)
        res.send({
          error: true
        })
      }
    })
  }
}
