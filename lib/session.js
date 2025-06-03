// core dependencies
const path = require('path')
const fs = require('fs')

// npm dependencies
const session = require('express-session')
const FileStore = require('./session-file-store')
const { get: getKeypath } = require('lodash')

// local dependencies
const { getConfig } = require('./config')
const { projectDir, sessionStoreDir } = require('./utils/paths')

// Add Nunjucks function called 'checked' to populate radios and checkboxes
function addCheckedFunction (env) {
  env.addGlobal('checked', function (name, value) {
    // Check data exists
    if (this.ctx.data === undefined) {
      return ''
    }

    // Use string keys or object notation to support:
    // checked("field-name")
    // checked("['field-name']")
    // checked("['parent']['field-name']")
    name = !name.match(/[.[]/g) ? `['${name}']` : name
    const storedValue = getKeypath(this.ctx.data, name)

    // Check the requested data exists
    if (storedValue === undefined) {
      return ''
    }

    let checked = ''

    // If data is an array, check it exists in the array
    if (Array.isArray(storedValue)) {
      if (storedValue.indexOf(value) !== -1) {
        checked = 'checked'
      }
    } else {
      // The data is just a simple value, check it matches
      if (storedValue === value) {
        checked = 'checked'
      }
    }
    return checked
  })
}

// Store data from POST body or GET query in session
function storeData (input, data) {
  for (const i in input) {
    // any input where the name starts with _ is ignored
    if (i.indexOf('_') === 0) {
      continue
    }

    let val = input[i]

    // Delete values when users unselect checkboxes
    if (val === '_unchecked' || val === ['_unchecked']) {
      delete data[i]
      continue
    }

    // Remove _unchecked from arrays of checkboxes
    if (Array.isArray(val)) {
      val = val.filter((item) => item !== '_unchecked')
    } else if (typeof val === 'object') {
      // Store nested objects that aren't arrays
      if (typeof data[i] !== 'object') {
        data[i] = {}
      }

      // Add nested values
      storeData(val, data[i])
      continue
    }

    data[i] = val
  }
}

// Get session default data from file

function loadSessionDataDefaults () {
  const sessionDataDefaultsFile = path.join(projectDir, 'app', 'data', 'session-data-defaults.js')

  if (fs.existsSync(sessionDataDefaultsFile)) {
    return require(sessionDataDefaultsFile)
  } else {
    return {}
  }
}

const sessionDataDefaults = loadSessionDataDefaults()

// Middleware - store any data sent in session, and pass it to all views

function autoStoreData (req, res, next) {
  if (!req.session) {
    next()
    return
  }

  res.locals.data = res.locals.userInput = {}
  req.session.userInput = req.session.data = { ...(req.session.data || {}), ...(req.session.userInput || {}) }

  req.session.userInput = Object.assign({}, sessionDataDefaults, req.session.userInput)

  storeData(req.body, req.session.userInput)
  storeData(req.query, req.session.userInput)

  // Send session data to all views

  for (const j in req.session.userInput) {
    res.locals.userInput[j] = req.session.userInput[j]
    req.session.data[j] = req.session.userInput[j]
  }

  next()
}

function getSessionNameFromWorkingDirectory (workingDirectory) {
  return 'nowprototypeit-' + (Buffer.from(workingDirectory, 'utf8')).toString('hex')
}

function getSessionMiddleware () {
  const config = getConfig()
  const workingDirectory = process.cwd()

  // Session uses working directory path to avoid clashes with other prototypes
  const sessionName = getSessionNameFromWorkingDirectory(workingDirectory)
  const sessionHours = 4
  const sessionOptions = {
    secret: sessionName,
    cookie: {
      maxAge: 1000 * 60 * 60 * sessionHours,
      secure: config.isSecure
    }
  }

  const fileStoreOptions = {
    path: sessionStoreDir
  }

  if (config.isDevelopment) {
    fileStoreOptions.logFn = sessionFileStoreQuietLogFn
  }

  return session(Object.assign(sessionOptions, {
    name: sessionName,
    resave: false,
    saveUninitialized: false,
    store: new FileStore(fileStoreOptions)
  }))
}

function sessionFileStoreQuietLogFn (message) { // copied for a quick performance test - this will be moved if improves performance
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

module.exports = {
  addCheckedFunction,
  getSessionMiddleware,
  autoStoreData
}
