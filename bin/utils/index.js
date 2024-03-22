// local dependencies
const { spawn } = require('../../lib/exec')
const fse = require('fs-extra')

const packageJsonFormat = { encoding: 'utf8', spaces: 2 }

async function npmInstall (cwd, dependencies) {
  if (dependencies.length === 0) {
    return
  }
  dependencies.push('--save-exact')
  const args = [
    'install',
    ...dependencies
  ]

  return spawn(
    'npm', args, {
      cwd,
      stderr: 'inherit'
    })
    .catch(e => {
      console.error('Failed to install dependencies: ', dependencies.join(', '))
      console.error(e)
      process.exit(0)
    })
}

function splitSemverVersion (version) {
  const versionParts = version.split('.').map(Number)

  return {
    major: versionParts[0],
    minor: versionParts[1],
    patch: versionParts[2]
  }
}

async function getPackageVersionFromPackageJson (packageJsonPath) {
  const version = (await fse.readJson(packageJsonPath)).version
  return splitSemverVersion(version)
}

module.exports = {
  npmInstall,
  packageJsonFormat,
  getPackageVersionFromPackageJson,
  splitSemverVersion
}
