const tar = require('tar-stream')
const { verboseLog } = require('./verboseLogger')
const zlib = require('node:zlib')

const extractTarGzFilesFromPipe = (options, response, resolve, reject) => {
  const filesToFind = (options.filesToFind || [options.fileToFind]).filter(x => x !== undefined)
  if (filesToFind.length === 0) {
    reject(new Error('No files to find'))
  }
  const extract = tar.extract()
  const data = {}

  extract.on('entry', function (header, stream, cb) {
    stream.on('data', function (chunk) {
      if (filesToFind.includes(header.name)) {
        data[header.name] = data[header.name] || []
        data[header.name].push(chunk.toString())
      }
    })

    stream.on('end', function () {
      cb()
    })

    stream.on('error', function (e) {
      verboseLog('Error from tar.extract stream', e)
    })

    stream.resume()
  })

  extract.on('finish', function () {
    let result

    if (options.fileToFind) {
      result = data[options.fileToFind]?.join('')
    } else {
      result = {}
      Object.keys(data).forEach((key) => {
        result[key] = data[key].join('')
      })
    }
    if (options.prepare) {
      resolve(options.prepare(result))
    } else {
      resolve(result)
    }
  })

  response
    .on('error', (e) => {
      verboseLog('Error from response', e)
      reject(new Error('Error extracting tar.gz file (start of pipe)', { cause: e }))
    })
    .pipe(zlib.createGunzip().on('error', (e) => {
      verboseLog('Error from gunzip', e)
      reject(new Error('Error extracting tar.gz file (gunzip error)', { cause: e }))
    }))
    .pipe(extract.on('error', (e) => {
      verboseLog('Error from extract', e)
      reject(new Error('Error extracting tar.gz file (tar error)', { cause: e }))
    }))
    .on('error', function (e) {
      verboseLog('Error from within .tgz pipe', e)
      reject(new Error('Error extracting tar.gz file (end of pipe)', { cause: e }))
    })
}

module.exports = { extractTarGzFilesFromPipe }
