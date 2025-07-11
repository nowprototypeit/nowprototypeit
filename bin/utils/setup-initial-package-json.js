const fse = require('fs-extra')
const { packageJsonFormat } = require('./index')
const targetPackageJson = {
  scripts: {
    dev: 'nowprototypeit dev || npx -y nowprototypeit@latest validate-kit dev $?',
    serve: 'nowprototypeit serve || npx -y nowprototypeit@latest validate-kit serve $?',
    start: 'nowprototypeit start || npx -y nowprototypeit@latest validate-kit start $?'
  }
}
async function writePackageJson (packageJsonPath) {
  let newPackageJson = Object.assign({}, targetPackageJson)
  newPackageJson = Object.assign(newPackageJson, await fse.readJson(packageJsonPath).catch(() => ({})))
  await fse.writeJson(packageJsonPath, newPackageJson, packageJsonFormat)
}

async function checkScriptsAreStandard (packageJsonPath) {
  const packageJsonData = await fse.readJson(packageJsonPath).catch(() => ({}))
  if (!packageJsonData.scripts) {
    return false
  }
  const standardScripts = Object.keys(targetPackageJson.scripts)
  const packageJsonScripts = Object.keys(packageJsonData.scripts)
  if (standardScripts !== packageJsonScripts || !standardScripts.every(script => packageJsonScripts.includes(script))) {
    return false
  }
  return standardScripts.every(script => packageJsonData.scripts[script] === targetPackageJson.scripts[script])
}

async function standardiseScripts (packageJsonPath) {
  const actualPackageJson = await fse.readJson(packageJsonPath).catch(() => null)
  if (actualPackageJson === null) {
    return await writePackageJson(packageJsonPath)
  }
  actualPackageJson.scripts = {
    ...targetPackageJson.scripts
  }
  await fse.writeJson(packageJsonPath, actualPackageJson, packageJsonFormat)
}

module.exports = { writePackageJson, checkScriptsAreStandard, standardiseScripts }
