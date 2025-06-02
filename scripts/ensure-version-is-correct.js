#!/usr/bin/env node

const fsp = require('node:fs').promises

process.exitCode = 100; // Default exit code in case the logic fails

(async () => {
  const [latestVersionFromNpm, versionFromPackageJson] = await Promise.all([
    fetch('https://registry.npmjs.org/nowprototypeit/latest').then(res => res.json()).then(json => json.version),
    fsp.readFile('package.json', 'utf8').then(data => JSON.parse(data).version)
  ])
  console.log('NPM version:', latestVersionFromNpm)
  console.log('package JSON version:', versionFromPackageJson)
  if (latestVersionFromNpm !== versionFromPackageJson) {
    console.error('')
    console.error(`Version mismatch! Latest NPM version [${latestVersionFromNpm}] does not match package.json version [${versionFromPackageJson}].`)
    console.error('We manage the project version as part of the release process, so any manual changes are problematic.')
    console.error('This can also happen if the post-release PR isn\'t merged yet, which would create an unhelpful order in the history.')
    console.error('')
    process.exit(1)
  } else {
    console.log('Version is correct.')
    process.exit(0)
  }
})()
