const { startPerformanceTimer, endPerformanceTimer } = require('../../utils/performance')
const path = require('path')
const { packageDir, projectDir } = require('../../utils/paths')
const sass = require('sass')
const fs = require('fs')
const os = require('os')
const fsp = fs.promises

const pathToModule = path.join(process.cwd(), 'node_modules', '@nowprototypeit', 'govuk')

const generatedDir = path.join(packageDir, 'generated')
const preBuiltSassLocation = path.join(generatedDir, 'manage-prototype-css')

async function kitDependencyIsInDevelopment () {
  if (fs.existsSync(generatedDir)) {
    return false
  }
  const lstat = await fsp.lstat(pathToModule).catch(e => ({ isSymbolicLink: () => false }))
  return lstat.isSymbolicLink()
}

function getNPIDesignSystemPath () {
  const mainNodeModules = path.join(projectDir, 'node_modules')
  const pathWithinModule = path.join('@nowprototypeit', 'design-system')
  const potentialPaths = [
    path.join(mainNodeModules, 'nowprototypeit/node_modules', pathWithinModule),
    path.join(mainNodeModules, pathWithinModule)
  ]
  return potentialPaths.find(x => fs.existsSync(x))
}

function getWindowsCompatibleRelativePath (tmpSassAndCssDir, x) {
  return path.relative(tmpSassAndCssDir, x).replaceAll(path.sep, '/')
}

async function generateManagePrototypeCss (builtAssetsLocation) {
  const timer = startPerformanceTimer()
  if (!builtAssetsLocation) {
    throw new Error('No asset location provided when generating management scss')
  }
  const committedScssDir = path.join(packageDir, 'lib', 'dev-server', 'manage-prototype', 'assets', 'sass')
  const tmpSassAndCssDir = path.join(os.tmpdir(), 'now-prototype-it', 'scss', '' + Date.now(), 'manage-prototype-css')
  const settingsFilePath = path.join(committedScssDir, 'settings.scss')
  const stylesFilePath = path.join(committedScssDir, 'styles.scss')
  const tmpSassFile = path.join(tmpSassAndCssDir, 'manage-prototype.scss')
  await fsp.mkdir(tmpSassAndCssDir, { recursive: true })
  await fsp.mkdir(builtAssetsLocation, { recursive: true })
  await fsp.writeFile(tmpSassFile, [
    settingsFilePath,
    path.join(getNPIDesignSystemPath(), 'assets', 'sass', 'styles.scss'),
    stylesFilePath
  ].map(x => `@import "${(getWindowsCompatibleRelativePath(tmpSassAndCssDir, x))}";`).join('\n'))
  try {
    const result = await sass.compileAsync(tmpSassFile, {
      quietDeps: true,
      loadPaths: [committedScssDir, path.join(packageDir, '..', 'node_modules')],
      sourceMap: true,
      sourceMapIncludeSources: true,
      style: 'expanded'
    })
    const outputFile = path.join(builtAssetsLocation, 'manage-prototype.css')
    await fsp.writeFile(outputFile, result.css, 'utf8')
    endPerformanceTimer('generateManagePrototypeCss', timer)
    return path.dirname(outputFile)
  } catch (e) {
    endPerformanceTimer('generateManagePrototypeCss (error)', timer)
    console.error('Error generating manage prototype CSS')
    console.error(e)
  }
}

async function generateManagePrototypeCssIfNecessary () {
  const tmpPath = path.join(projectDir, '.tmp', 'manage-prototype-css')
  if (await kitDependencyIsInDevelopment()) {
    return await generateManagePrototypeCss(tmpPath)
  }
  if (fs.existsSync(preBuiltSassLocation)) {
    return preBuiltSassLocation
  }
  return await generateManagePrototypeCss(tmpPath)
}

function getPathToGeneratedCss () {
  if (fs.existsSync(preBuiltSassLocation)) {
    return preBuiltSassLocation
  }
  return path.join('.tmp', 'manage-prototype-css')
}

function getPathToDesignSystemSubdir (subDir) {
  return () => {
    const npiDesignSystemPath = getNPIDesignSystemPath()
    const potentialPaths = [path.join(generatedDir, subDir)]
    if (npiDesignSystemPath) {
      potentialPaths.push(path.join(npiDesignSystemPath, subDir))
    }
    const result = potentialPaths.find(x => fs.existsSync(x))
    if (result) {
      return result
    }
    throw new Error('No path found for ' + subDir + ' checked: [' + potentialPaths.join(', ') + ']')
  }
}

const getPathToDesignSystemNunjucks = getPathToDesignSystemSubdir('nunjucks')
const getPathToDesignSystemAssets = getPathToDesignSystemSubdir('assets')

async function buildBeforeRelease () {
  await Promise.all(['nunjucks', 'assets'].map(x => fsp.cp(path.join(getNPIDesignSystemPath(), x), path.join(generatedDir, x), { recursive: true })))
  await generateManagePrototypeCss(preBuiltSassLocation)
}

module.exports = {
  generateManagePrototypeCss,
  getNPIDesignSystemPath,
  generateManagePrototypeCssIfNecessary,
  buildBeforeRelease,
  kitDependencyIsInDevelopment,
  getPathToDesignSystemNunjucks,
  getPathToDesignSystemAssets,
  getPathToGeneratedCss
}
