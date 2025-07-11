const { getMessages } = require('../../lib/utils/messages-from-api')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { verboseLog } = require('../../lib/utils/verboseLogger')
const { writePackageJson, checkScriptsAreStandard, standardiseScripts } = require('./setup-initial-package-json')
const { exec } = require('../../lib/exec')
const { shutdown } = require('../../lib/utils/shutdownHandlers')
const projectDir = process.cwd()
const projectPackageJsonPath = path.join(projectDir, 'package.json')

let currentListenerForStdIn = null
let currentStdInOptions = null
let userAllowsAllChanges = false

process.stdin.on('data', (data) => {
  const info = data.toString().trim().toLowerCase()
  console.log('')
  if (currentListenerForStdIn) {
    currentListenerForStdIn(currentStdInOptions[info])
  } else {
    verboseLog('No current listener for stdin, ignoring input:', info)
  }
})

module.exports = {
  validateKit
}

async function cannotContinue () {
  console.error('')
  console.error('To re-run this process run:')
  console.error('')
  console.error('npx nowprototypeit@latest validate-kit')
  console.error('')
  await shutdown('cli validate-kit', 1)
}

async function validateKit () {
  let shouldLookForRequiredPlugins = false
  let changesMade = false
  if (!await readProjectPackageJson()) {
    if (!await fsp.access(projectPackageJsonPath).catch(() => false)) {
      const userResponse = await askUserQuestionWithYesNoAutoOptions('We can\'t identify a package.json in your project, this is required. Do you want us to create one for you?')
      if (userResponse === 'yes') {
        await writePackageJson(projectPackageJsonPath)
        shouldLookForRequiredPlugins = true
        changesMade = true
      } else {
        console.error('Cannot continue without a package.json file.')
        return await cannotContinue()
      }
    }
  }
  const npiVersion = await lookupNpiVersion()
  const messagesFromServer = await getMessages(npiVersion, 'validate-kit', 'plain-text')
  if (!npiVersion) {
    const result = await askUserQuestionWithYesNoAutoOptions('We can\'t identify the version of Now Prototype It that you\'re using, would you like to install the latest version?')
    if (result === 'yes') {
      changesMade = true
      await exec('npm install --save nowprototypeit@latest', { cwd: projectDir })
    } else {
      console.error('Cannot continue without Now Prototype It installed.')
      return await cannotContinue()
    }
  }
  if (!await checkScriptsAreStandard(projectPackageJsonPath)) {
    const result = await askUserQuestionWithYesNoAutoOptions('The scripts in your package.json do not match the standard scripts used by Now Prototype It. Would you like us to update them for you?')
    if (result === 'yes') {
      changesMade = true
      await standardiseScripts(projectPackageJsonPath)
    }
  }
  if (messagesFromServer && messagesFromServer.messages && messagesFromServer.messages.length > 0) {
    console.log('Messages from the Now Prototype It:')
    console.log('')
    console.log(messagesFromServer.messages?.map(x => ` - ${x}`).join('\n'))
    console.log('')
  }
  if (shouldLookForRequiredPlugins) {
    const { changesMadeInFn } = await lookForRequiredPlugins(userAllowsAllChanges)
    if (changesMadeInFn) {
      changesMade = true
    }
  }
  if (changesMade) {
    await exec('npm install', { cwd: projectDir })
    console.log('Changes were made to your project, please try again to start your prototype using:')
    console.log('')
    console.log('npm run dev')
    console.log('')
    await shutdown('cli validate-kit')
  } else {
    console.log()
    console.log('We couldn\'t find anything wrong with your prototype, if you think something is wrong, please contact us at support@nowprototype.it')
    console.log()
    await shutdown('cli validate-kit')
  }
}

async function lookupNpiVersion () {
  const potentialMatches = await Promise.all([readVersionFromDependencyDefinition(), readVersionFromNodeModulesDir()])

  verboseLog('potentialMatches', potentialMatches)

  return potentialMatches.find(x => !!x) || null
}

async function readProjectPackageJson () {
  try {
    const data = await fsp.readFile(projectPackageJsonPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    verboseLog('Error reading package.json:', error)
    return null
  }
}

async function readVersionFromDependencyDefinition () {
  try {
    const packageJson = await readProjectPackageJson()
    if (packageJson && packageJson.devDependencies && packageJson.devDependencies['now-prototype-it']) {
      return packageJson.devDependencies['now-prototype-it'] || null
    }
    return null
  } catch (error) {
    verboseLog('Error reading package.json:', error)
    return null
  }
}

async function readVersionFromNodeModulesDir () {
  try {
    const data = await fsp.readFile(path.join(projectDir, 'node_modules', 'nowprototypeit', 'package.json'), 'utf8')
    const packageJson = JSON.parse(data)
    if (packageJson && packageJson.version) {
      return packageJson.version || null
    }
  } catch (error) {
    verboseLog('Error reading now-prototype-it package.json:', error)
    return null
  }
}

async function lookForRequiredPlugins (userAllowsAllChanges = false) {
  let changesMadeInFn = false
  let userAllowsAllChangesDuringFn = false
  const fileNames = await readDirRecursive(path.join(projectDir))
  const njkFiles = fileNames
    .filter(fileName => fileName.endsWith('.njk'))

  const govukDeps = ['@nowprototypeit/govuk-frontend-adaptor', 'govuk-frontend', '@govuk-prototype-kit/common-templates']
  const detectablePlugins = {
    'govuk-frontend': {
      npmDeps: [...govukDeps],
      searchStrings: ['govuk-'],
      alreadyFound: false
    },
    'hmrc-frontend': {
      npmDeps: ['hmrc-frontend', ...govukDeps],
      searchStrings: ['hmrc-', 'hmrc/'],
      alreadyFound: false
    }
  }

  const dependencies = new Set()

  while (njkFiles.length > 0) {
    const fileName = njkFiles.pop()
    const fileContents = await fsp.readFile(fileName, 'utf8')
    let shouldBreak = false
    Object.keys(detectablePlugins).forEach(pluginName => {
      const config = detectablePlugins[pluginName]
      if (!config.alreadyFound && config.searchStrings.some(searchStr => fileContents.includes(searchStr))) {
        config.alreadyFound = true
        config.npmDeps.forEach(dep => dependencies.add(dep))
        if (!Object.values(detectablePlugins).find(({ alreadyFound }) => !alreadyFound)) {
          shouldBreak = true
        }
      }
    })
    if (shouldBreak) {
      break
    }
  }
  const depArr = [...dependencies]
  const questionString = `Would you like to install the following dependencies?

${depArr.map(dep => ` - ${dep}`).join('\n')}`

  if (depArr.length > 0) {
    const result = await askUserQuestionWithYesNoAutoOptions(questionString)
    if (result === 'all') {
      userAllowsAllChangesDuringFn = true
    }
    if (userAllowsAllChanges || userAllowsAllChangesDuringFn || result === 'yes') {
      await exec(`npm install --save ${depArr.join(' ')}`, { cwd: projectDir })
      changesMadeInFn = true
    }
  }
  return {
    changesMadeInFn,
    userAllowsAllChangesDuringFn
  }
}

async function readDirRecursive (dir) {
  const entries = await fsp.readdir(dir)
  const fileNames = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stats = await fsp.stat(fullPath)
    if (stats.isDirectory()) {
      const subDirFiles = await readDirRecursive(fullPath)
      fileNames.push(...subDirFiles)
    } else {
      fileNames.push(fullPath)
    }
  }

  return fileNames
}

function askUserQuestionWithYesNoAutoOptions (question, { skipAllOption = false } = {}) {
  if (userAllowsAllChanges) {
    return 'yes'
  }
  return new Promise((resolve) => {
    currentListenerForStdIn = result => {
      if (result === 'yes' || result === 'no' || result === 'all') {
        currentListenerForStdIn = null
        currentStdInOptions = null
        if (result === 'all') {
          userAllowsAllChanges = true
          resolve('yes')
        } else {
          resolve(result)
        }
      } else {
        logOptions()
      }
    }
    currentStdInOptions = {
      y: 'yes',
      yes: 'yes',
      n: 'no',
      no: 'no',
      a: 'all',
      all: 'all'
    }
    console.log('')
    console.log(question)
    logOptions()

    function logOptions () {
      console.log('')
      const allShorthand = skipAllOption ? '' : '/a'
      const allLonghand = skipAllOption ? '' : '/all'
      console.log('')
      console.log(`y/n${allShorthand} (yes/no${allLonghand}).  All will mean we'll try everything we can without asking any more questions`)
      console.log('')
      console.log('Type your answer and press Enter:')
    }
  })
}
