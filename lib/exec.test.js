const fs = require('fs')
const path = require('path')
const os = require('os')

const exec = require('./exec').exec

const isWindows = os.platform().startsWith('win')
const skipOnWindows = (fn) => {
  if (!isWindows) {
    fn()
  }
}

describe('exec', () => {
  it('should provide an output from stdout', async () => {
    const outputParts = []

    await exec('echo hello', {}, output => outputParts.push(output.toString()))

    expect(outputParts[0].trim()).toEqual('hello')
  })
  skipOnWindows(() => {
    it('should be able to create and delete files', async () => {
      const fileName = 'this-is-a-test-file.txt'
      const filePath = path.join(__dirname, fileName)

      const touchCommand = isWindows ? 'copy nul >' : 'touch'
      const rmCommand = isWindows ? 'del' : 'rm'
      await exec(`${touchCommand} ${fileName}`, { cwd: __dirname })
      fs.writeFileSync(filePath, 'hello world', 'utf8')
      expect(fs.existsSync(filePath)).toBe(true)

      await exec(`${rmCommand} ${fileName}`, { cwd: __dirname })
      expect(fs.existsSync(filePath)).toBe(false)
    })
    it('should error when a command fails', async () => {
      let catchCalled = false

      await exec('sadflkajsdfoiewflkjsadf')
        .catch(() => {
          catchCalled = true
        })

      expect(catchCalled).toBe(true)
    })
    it('should provide the error code and message', async () => {
      let catchCalled = false

      await exec('which asldfkj')
        .catch((e) => {
          catchCalled = true
          expect(e.code).toBe(1)
          expect(e.message).toBe('Exit code was [1] for command [which asldfkj]')
          expect(e.errorOutput).not.toBeDefined()
        })

      expect(catchCalled).toBe(true)
    })
    it('should provide the error code and message', async () => {
      let catchCalled = false

      await exec('echo >&2 "this is the error message"; exit 4')
        .catch((e) => {
          catchCalled = true
          expect(e.code).toBe(4)
          expect(e.message).toBe('Exit code was [4] for command [echo >&2 "this is the error message"; exit 4]')
          expect(e.errorOutput).toBe('this is the error message\n')
        })

      expect(catchCalled).toBe(true)
    })
  })
})
