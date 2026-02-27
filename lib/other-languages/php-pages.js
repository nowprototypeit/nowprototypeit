const { spawnSync } = require('node:child_process')
const path = require('node:path')
const crypto = require('node:crypto')
const tmpDir = path.join(require('node:os').tmpdir(), 'nowprototypeit-php-rendering', crypto.randomUUID())

let count = 0
const fs = require('node:fs')
const fsp = fs.promises

fs.mkdirSync(tmpDir, { recursive: true })

async function renderPhp (template, userInput = {}) {
  console.log('userInput', userInput)
  const tmpPhpPath = path.join(tmpDir, `${count++}.php`)
  const contents = [aiGeneratedCreateUserInputVariables(userInput), `<?php require('${template}') ?>`].join('\n')
  await fsp.writeFile(tmpPhpPath, contents, 'utf-8')
  const phpProcessResult = spawnSync('php', ['-f', tmpPhpPath])
  fsp.unlink(tmpPhpPath).catch(() => {})

  if (phpProcessResult.status === 0) {
    const phpStdOutArray = Array.isArray(phpProcessResult.stdout) ? phpProcessResult.stdout : [phpProcessResult.stdout]
    return {
      success: true,
      contents: phpStdOutArray.map(x => x.toString('utf-8')).join('')
    }
  } else {
    console.log('!!!! STDERR from PHP rendering: !!!!!')
    const phpStdErrArray = Array.isArray(phpProcessResult.stderr) ? phpProcessResult.stderr : [phpProcessResult.stderr]
    phpStdErrArray.forEach(x => console.log(x.toString('utf-8')))
    console.log('!!!! END STDERR from PHP rendering !!!!!')
    return {
      success: false,
      details: {
        message: 'Error in PHP rendering',
        // type: err.type,
        stack: new Error().stack,
        // name: err.name,
        reportedFilename: template
        // reportedLineNumber: err.lineNumber,
        // reportedColumn: err.column
      }
    }
  }
}

function aiGeneratedConvertJsToPhp (data, variableName = 'userInput', indent = 0) {
  const spaces = '  '.repeat(indent)

  if (data === null) {
    return 'NULL'
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '[]'
    }
    const items = data.map(item =>
      `${spaces}  ${aiGeneratedConvertJsToPhp(item, variableName, indent + 1)}`
    ).join(',\n')
    return `[\n${items}\n${spaces}]`
  }

  if (typeof data === 'object') {
    if (Object.keys(data).length === 0) {
      return '[]'
    }
    const items = Object.entries(data).map(([key, value]) =>
      `${spaces}  '${key}' => ${aiGeneratedConvertJsToPhp(value, variableName, indent + 1)}`
    ).join(',\n')
    return `[\n${items}\n${spaces}]`
  }

  if (typeof data === 'string') {
    return `'${data.replace(/'/g, "\\'")}'`
  }

  if (typeof data === 'boolean') {
    return data ? 'true' : 'false'
  }

  if (typeof data === 'number') {
    return data.toString()
  }

  return 'NULL' // fallback for undefined or unknown types
}

function aiGeneratedCreateUserInputVariables (data, variableName = 'userInput') {
  return `<?php\n$${variableName} = ${aiGeneratedConvertJsToPhp(data, variableName)};\n?>`
}

module.exports = {
  renderPhp
}
