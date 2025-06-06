const fsp = require('fs').promises

const paths = require('./paths')
const { getKnownPlugins } = require('../plugins/plugins')

async function tryParsingModuleNotFoundError (stderrLinesReversed) {
  function findLineIndex (searchString, array) {
    return array.findIndex(x => x.includes(searchString))
  }

  const requireStackLineIndex = findLineIndex('Require stack:', stderrLinesReversed)
  if (requireStackLineIndex === -1) {
    return
  }
  const remainingLinesAfterStack = stderrLinesReversed.slice(requireStackLineIndex + 1)
  const errorLineIndex = findLineIndex('Error:', remainingLinesAfterStack)
  if (errorLineIndex === -1) {
    return
  }
  const stackLines = stderrLinesReversed.slice(0, requireStackLineIndex).reverse()
  const errorLines = remainingLinesAfterStack.slice(0, errorLineIndex + 1).reverse()
  const errorMessageBeforeCheck = errorLines.join('\n')
  const errorMessage = errorMessageBeforeCheck.startsWith('Error: ') ? errorMessageBeforeCheck.substring(7) : errorMessageBeforeCheck
  const errorMessageParts = errorMessage.split('\'')
  const output = {
    filePath: stackLines[0].split(' ')[1],
    message: errorMessage,
    stackTrace: stackLines.join('\n'),
    fullError: errorLines.concat(stackLines).join('\n'),
    parsedBy: 'tryParsingModuleNotFoundError'
  }
  const moduleName = errorMessageParts[1]
  const knownPlugins = getKnownPlugins()
  if (errorMessageParts.length === 3 && errorMessageParts[0] === 'Cannot find module ' && knownPlugins.includes(moduleName)) {
    output.recommendPlugin = moduleName
    output.recommendPluginRef = `npm:${moduleName}`
    output.highlightLinesContaining = moduleName
  }
  return output
}

function getFileDescriptionFromLine (currentLineContents) {
  let isWindows = false
  if (currentLineContents.includes(paths.projectDir) || currentLineContents.includes(paths.packageDir)) {
    const fileDescriptionParts = currentLineContents.trim().split(':')
    const windowsDriveNameMaximumLength = 1
    if (fileDescriptionParts[0].length <= windowsDriveNameMaximumLength) {
      isWindows = true
      fileDescriptionParts.unshift(fileDescriptionParts.shift() + ':' + fileDescriptionParts.shift())
    }
    return {
      filePath: fileDescriptionParts[0],
      line: fileDescriptionParts[1],
      column: fileDescriptionParts[2],
      isWindows
    }
  }
}

async function tryParsingNodeError (stderrLinesReversed, fullError) {
  let currentLine = 0
  const lines = stderrLinesReversed.filter(x => x !== '')
  const endNotReached = () => lines.length > currentLine

  while (endNotReached() && !lines[currentLine].trim().startsWith('at')) {
    currentLine += 1
  }

  const stackTraceLines = []
  while (endNotReached() && lines[currentLine].trim().startsWith('at')) {
    stackTraceLines.push(lines[currentLine++])
  }

  const messageLine = lines[currentLine++]
  if (!messageLine) {
    return
  }
  const splitMessageLine = messageLine.split(':').map(x => x.trim())
  const [type, message] = splitMessageLine.length === 1 ? [undefined, messageLine] : splitMessageLine
  let fileDescriptionParts
  while (endNotReached() && fileDescriptionParts === undefined) {
    const currentLineContents = lines[currentLine]
    fileDescriptionParts = getFileDescriptionFromLine(currentLineContents)
    currentLine++
  }
  const { filePath, line, column, isWindows } = fileDescriptionParts || {}

  return {
    filePath,
    line: line && Number(line),
    column: column && Number(column),
    message,
    type,
    stackTrace: stackTraceLines.reverse().join('\n'),
    fullError,
    isWindows,
    parsedBy: 'tryParsingNodeError'
  }
}

async function getSourceCodeLines (result) {
  function isHighlightedLine (lineNumber, content, contextLines) {
    if (result.line === lineNumber) {
      if (result.highlightPreviousUsefulLine) {
        contextLines.forEach(line => {
          line.highlighted = true
        })
      }
      return true
    }
    if (result.highlightLinesContaining && (content || '').includes(result.highlightLinesContaining)) {
      return true
    }
    return false
  }

  try {
    const fileContents = await fsp.readFile(result.filePath, 'utf8')
    let lineNumber = 1
    const contextLines = []
    let isFirstDisplayedLine = true
    return fileContents.split('\n').map(line => {
      const number = lineNumber++
      if (result.line && (result.line < number - 15 || result.line > number + 15)) {
        return undefined
      }
      if (isFirstDisplayedLine && number !== 1 && line.trim().length === 0) {
        return undefined
      }
      isFirstDisplayedLine = false
      const lineOutput = {
        highlighted: isHighlightedLine(number, line, contextLines),
        number,
        contents: line
      }
      if (line.trim() !== '') {
        while (contextLines.length) {
          contextLines.pop()
        }
      }
      contextLines.push(lineOutput)
      return lineOutput
    }).filter(x => x !== undefined)
  } catch (e) {}
}

function prepareFilePath (absolutePath) {
  if (typeof absolutePath !== 'string') {
    return undefined
  }
  if (absolutePath?.startsWith(paths.projectDir)) {
    const replaced = absolutePath.replace(paths.projectDir, '')
    if (replaced.startsWith('/') || replaced.startsWith('\\')) {
      return replaced.substring(1)
    }
    return replaced
  }
  return absolutePath
}

async function addStandardModel (result, parsedSuccessfully, lastReloadTimestamp) {
  const output = {
    ...result,
    filePath: prepareFilePath(result?.filePath),
    parsedSuccessfully,
    lastReloadTimestamp: lastReloadTimestamp || Date.now()
  }

  if (parsedSuccessfully) {
    output.sourceCodeLines = await getSourceCodeLines(result)
  }

  return output
}

async function getErrorModelFromStderr (stderr, requestTimestamp) {
  const stderrLinesReversed = stderr.split('\n').reverse()
  const parsersToTry = [tryParsingModuleNotFoundError, tryParsingNodeError]
  while (parsersToTry.length > 0) {
    const result = await parsersToTry.shift()(stderrLinesReversed, stderr)
    if (result) {
      return await addStandardModel({ ...result, stderr }, true)
    }
  }
  return await addStandardModel({ fullError: stderr }, false, requestTimestamp)
}

async function parseNunjucksError (errObj, requestTimestamp) {
  const details = {
    parsedBy: 'parseNunjucksError'
  }
  if (errObj.message.startsWith('(')) {
    const [file, ...otherMessageParts] = errObj.message.substring(1).split(')')
    details.filePath = file
    details.type = errObj.type || errObj.name
    details.fullError = errObj.stack
    const [beforeCheckedDirs, afterCheckedDirs] = otherMessageParts.join(')').split(', directories checked are:')
    if (afterCheckedDirs) {
      details.message = beforeCheckedDirs
      const dirNames = afterCheckedDirs.split(',')
      if (dirNames.length > 0) {
        const markup = '<ul class="nowprototypeit-bullet-list"><li>' + dirNames.join('</li><li>') + '</li></ul>'
        details.additionalInfoMarkup = ['The following directories were checked:', markup].join('')
      }
    } else {
      const message = otherMessageParts.join(')').trim()
      if (message.startsWith('[Line')) {
        const [tmp, messageAfterLineAndColumn] = message.split('[')[1].split(']')
        const [line, column] = tmp.split(',').map(x => x.trim().split(' ')[1])
        details.message = messageAfterLineAndColumn.trim()
        details.line = Number(line)
        details.column = Number(column)
        if (details.message.startsWith('parseSignature: expected ')) {
          details.highlightPreviousUsefulLine = true
        }
      } else {
        details.message = message
      }
    }
  }
  if (details.message && details.message.trim().startsWith('Error: ')) {
    details.message = details.message.trim().substring(7).trim()
  }
  if (details.line === undefined && details.message?.includes('not found:')) {
    details.highlightLinesContaining = details.message.split('not found:')[1].trim()
  }
  return await addStandardModel(details, true, requestTimestamp)
}

async function getErrorModelFromErrObj (errObj, requestTimestamp) {
  if (errObj.isNunjucksError || errObj.name === 'Template render error') {
    return await parseNunjucksError(errObj, requestTimestamp)
  }
  return await addStandardModel({ fullError: errObj.stack, ...errObj }, false, requestTimestamp)
}

async function getErrorModelFromException (err, lastReloadTimestamp) {
  return await addStandardModel({
    type: err.type || err.code || err.name,
    name: err.name,
    message: err.message,
    fullError: err.stack,
    parsedBy: 'getErrorModelFromException'
  }, true, lastReloadTimestamp)
}

module.exports = {
  getErrorModelFromStderr,
  getErrorModelFromErrObj,
  getErrorModelFromException
}
