const { getErrorModelFromStderr } = require('./errorModel')

const ubuntuStackTrace = `    at internalCompileFunction (node:internal/vm:128:18)
    at wrapSafe (node:internal/modules/cjs/loader:1280:20)
    at Module._compile (node:internal/modules/cjs/loader:1332:27)
    at Module._extensions..js (node:internal/modules/cjs/loader:1427:10)
    at Module.load (node:internal/modules/cjs/loader:1206:32)
    at Module._load (node:internal/modules/cjs/loader:1022:12)
    at Module.require (node:internal/modules/cjs/loader:1231:19)
    at require (node:internal/modules/helpers:179:18)
    at loadSessionDataDefaults (/home/natalie/projects/nowprototypeit/nowprototypeit/lib/session.js:92:12)
    at Object.<anonymous> (/home/natalie/projects/nowprototypeit/nowprototypeit/lib/session.js:98:29)`

const ubuntuExample = `/home/natalie/projects/prototype-kits/now-prototype-it-companion/app/data/session-data-defaults.js:2
  'broken'
  ^^^^^^^^

SyntaxError: Unexpected string
${ubuntuStackTrace}
    
    Node v20.12.0
`

const windowsStackTrace = `    at internalCompileFunction (node:internal/vm:73:18)
    at wrapSafe (node:internal/modules/cjs/loader:1176:20)
    at Module._compile (node:internal/modules/cjs/loader:1218:27)
    at Module._extensions..js (node:internal/modules/cjs/loader:1308:10)
    at Module.load (node:internal/modules/cjs/loader:1117:32)
    at Module._load (node:internal/modules/cjs/loader:958:12)
    at Module.require (node:internal/modules/cjs/loader:1141:19)
    at require (node:internal/modules/cjs/helpers:110:18)
    at loadSessionDataDefaults (C:\\Users\\nat\\projects\\prototype-kits\\session-data-defaults\\node_modules\\nowprototypeit\\lib\\session.js:92:12)
    at Object.<anonymous> (C:\\Users\\nat\\projects\\prototype-kits\\session-data-defaults\\node_modules\\nowprototypeit\\lib\\session.js:98:29)`

const windowsExample = `C:\\Users\\nat\\projects\\prototype-kits\\session-data-defaults\\app\\data\\session-data-defaults.js:2
  'broken'
  ^^^^^^^^

SyntaxError: Unexpected string
${windowsStackTrace}`

const paths = require('./paths')
const path = require('node:path')

describe('errorModel', () => {
  describe('parsing errors from stderr', () => {
    let testScope
    beforeEach(() => {
      testScope = {}
      testScope.origPaths = {
        projectDir: paths.projectDir,
        packageDir: paths.packageDir
      }
      testScope.origPathSep = path.sep
    })
    afterEach(() => {
      paths.packageDir = testScope.origPaths.packageDir
      paths.projectDir = testScope.origPaths.projectDir
      path.sep = testScope.origPathSep
    })
    it('should parse Ubuntu Syntax Error stack trace', async () => {
      paths.projectDir = '/home/natalie/projects/prototype-kits/now-prototype-it-companion/'
      // const prep = prepareInput(ubuntuExample)
      const result = await getErrorModelFromStderr(ubuntuExample)
      expect(result.message).toBe('Unexpected string')
      expect(result.type).toBe('SyntaxError')
      expect(result.parsedBy).toBe('tryParsingNodeError')
      expect(result.line).toBe(2)
      expect(result.column).toBe(undefined)
      expect(result.filePath).toBe('app/data/session-data-defaults.js')
      expect(result.stackTrace).toBe(ubuntuStackTrace)
      expect(result.fullError).toBe(ubuntuExample)
    })
    it('should parse Windows Syntax Error stack trace', async () => {
      paths.projectDir = 'C:\\Users\\nat\\projects\\prototype-kits\\session-data-defaults'
      path.sep = '\\'
      const result = await getErrorModelFromStderr(windowsExample)
      expect(result.message).toBe('Unexpected string')
      expect(result.type).toBe('SyntaxError')
      expect(result.parsedBy).toBe('tryParsingNodeError')
      expect(result.line).toBe(2)
      expect(result.column).toBe(undefined)
      expect(result.filePath).toBe('\\app\\data\\session-data-defaults.js')
      expect(result.stackTrace).toBe(windowsStackTrace)
      expect(result.fullError).toBe(windowsExample)
    })
  })
})
