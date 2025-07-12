const fsp = require('node:fs/promises')
const path = require('node:path')

const bodyParser = require('body-parser')
const express = require('express')

const { projectDir, packageDir } = require('../../../utils/paths')
const { getConfig } = require('../../../config')

const jsonBodyParser = bodyParser.json()

const mapSelector = x => {
  const selectorToAdd = '.nowprototypeit-injected-elements'
  if (x.includes(selectorToAdd)) {
    return x
  }
  return x.trim() === '' ? '' : ` ${selectorToAdd}${x}`
}

const mapStyle = x => {
  if (x.includes('!important')) {
    return x
  }
  return x.trim() === '' ? '' : `${x} !important`
}

function editInBrowserEnabled (req, res, next) {
  if (getConfig().editInBrowser) {
    next()
  } else {
    res.status(403).send({
      error: 'Edit in browser is not enabled'
    })
  }
}

function replace (cssContents, position, endOfCurrentStatement, separator, replacer) {
  const currentStatement = cssContents.substring(position, endOfCurrentStatement)
  const beforeCurrentStatement = cssContents.substring(0, position)
  const afterCurrentStatement = cssContents.substring(endOfCurrentStatement)
  return [
    beforeCurrentStatement,
    currentStatement.split(separator).map(replacer).join(separator),
    afterCurrentStatement
  ].join('')
}

module.exports = {
  editInBrowser: (app, config) => {
    app.use('/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs', express.static(path.join(packageDir, 'node_modules', 'monaco-editor', 'min', 'vs')))
    app.use('/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs', express.static(path.join(projectDir, 'node_modules', 'monaco-editor', 'min', 'vs')))
    app.use('/manage-prototype/assets/edit-in-browser/main-include.js', express.static(path.join(packageDir, 'lib', 'dev-server', 'manage-prototype', 'assets', 'scripts', 'edit-in-browser.js')))
    app.use('/manage-prototype/assets/edit-in-browser/main-include.css', async (req, res) => {
      let cssContents = (await fsp.readFile(path.join(packageDir, 'lib', 'dev-server', 'manage-prototype', 'assets', 'css', 'edit-in-browser.css'), 'utf8')).replaceAll(/\s+/g, ' ')
      const searchString = '/* end of global */'
      let position = cssContents.indexOf(searchString)
      if (position > -1) {
        position += searchString.length
      } else {
        position = 0
      }
      while (true) {
        const endOfCurrentStatement = cssContents.indexOf('{', position)
        if (endOfCurrentStatement === -1) {
          break
        }
        cssContents = replace(cssContents, position, endOfCurrentStatement, ',', mapSelector)
        position = cssContents.indexOf('{', position) + 1
        const endOfStyleBlock = cssContents.indexOf('}', position)
        cssContents = replace(cssContents, position, endOfStyleBlock, ';', mapStyle)
        position = cssContents.indexOf('}', position) + 1
      }
      res.set('content-type', 'text/css')
      res.send(cssContents)
    })
    app.get('/manage-prototype/edit-in-browser/file-contents', [editInBrowserEnabled], async (req, res) => {
      const { relativeFilePath } = req.query
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
    app.put('/manage-prototype/edit-in-browser/file-contents', [editInBrowserEnabled, jsonBodyParser], async (req, res) => {
      const { relativeFilePath } = req.query
      const { fileContents } = req.body
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
