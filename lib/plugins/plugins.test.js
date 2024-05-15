/* eslint-env jest */
/* eslint-disable no-prototype-builtins */

// core dependencies
const path = require('path')

// local dependencies
const config = require('../config')
const plugins = require('./plugins')
const fakeFileSystem = require('../../__tests__/utils/mock-file-system')

// Local variables
const rootPath = path.join(__dirname, '..', '..')
let testScope

// helpers
const joinPaths = arr => arr.map(x => path.join.apply(null, [rootPath].concat(x)))

describe('plugins', () => {
  beforeEach(() => {
    testScope = {
      fileSystem: fakeFileSystem.mockFileSystem(rootPath)
    }
    testScope.fileSystem.writeFile(['package.json'], '{ "dependencies": {} }')
    testScope.fileSystem.setupSpies()
    jest.spyOn(config, 'getConfig').mockImplementation(() => {
      return testScope.appConfig
    })
    plugins.setPluginsByType()
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Ordering', () => {
    it('should be in alphabetical order by default', () => {
      mockPluginConfig('abc', { assets: '/' })
      mockPluginConfig('ghi', { assets: '/' })
      mockPluginConfig('def', { assets: '/' })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/abc', '/plugin-assets/def', '/plugin-assets/ghi'
      ])
    })
    it('should put dependencies before the plugin that refers to it', () => {
      mockPluginConfig('abc', { pluginDependencies: ['ghi'], assets: '/' })
      mockPluginConfig('def', { assets: '/' })
      mockPluginConfig('ghi', { assets: '/' })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/ghi', '/plugin-assets/abc', '/plugin-assets/def'
      ])
    })
    it('should put dependencies before the plugin that refers to it when using object for dependency', () => {
      mockPluginConfig('abc', { pluginDependencies: [{ packageName: 'ghi' }], assets: '/' })
      mockPluginConfig('def', { assets: '/' })
      mockPluginConfig('ghi', { assets: '/' })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/ghi', '/plugin-assets/abc', '/plugin-assets/def'
      ])
    })
    it('should deal with multiple levels of dependency', () => {
      mockPluginConfig('abc', { pluginDependencies: ['jkl'], assets: '/' })
      mockPluginConfig('def', { assets: '/' })
      mockPluginConfig('ghi', { pluginDependencies: ['def'], assets: '/' })
      mockPluginConfig('jkl', { pluginDependencies: ['ghi'], assets: '/' })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/def', '/plugin-assets/ghi', '/plugin-assets/jkl', '/plugin-assets/abc'
      ])
    })
    it('should move plugins as little as possible', () => {
      mockPluginConfig('abc', { assets: '/' })
      mockPluginConfig('def', { assets: '/' })
      mockPluginConfig('ghi', { pluginDependencies: ['jkl'], assets: '/' })
      mockPluginConfig('jkl', { assets: '/' })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/abc', '/plugin-assets/def', '/plugin-assets/jkl', '/plugin-assets/ghi'
      ])
    })
  })

  describe('Lookup file system paths', () => {
    it('should lookup asset paths as file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      expect(plugins.getFileSystemPaths('assets')).toEqual(joinPaths([
        ['node_modules', 'govuk-frontend', 'govuk', 'assets']
      ]))
    })
    it('should not allow traversing the file system', () => {
      mockPluginConfig('govuk-frontend', { assets: ['/abc/../../../../../def'] })
      expect(plugins.getFileSystemPaths('assets')).toEqual(joinPaths([
        ['node_modules', 'govuk-frontend', 'abc', 'def']
      ]))
    })
    it('should show installed plugins asset paths as file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl']
      })
      expect(plugins.getFileSystemPaths('assets')).toEqual(joinPaths([
        ['node_modules', 'another-frontend', 'abc'],
        ['node_modules', 'another-frontend', 'def'],
        ['node_modules', 'govuk-frontend', 'govuk', 'assets'],
        ['node_modules', 'hmrc-frontend', 'ghi'],
        ['node_modules', 'hmrc-frontend', 'jkl']
      ]))
    })
    it('should follow strict alphabetical order when no base plugins used', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl']
      })
      expect(plugins.getFileSystemPaths('assets')).toEqual(joinPaths([
        ['node_modules', 'another-frontend', 'abc'],
        ['node_modules', 'another-frontend', 'def'],
        ['node_modules', 'govuk-frontend', 'govuk', 'assets'],
        ['node_modules', 'hmrc-frontend', 'ghi'],
        ['node_modules', 'hmrc-frontend', 'jkl']
      ]))
    })
    it('should show installed plugins asset paths as file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/abc', '/def']
      })
      expect(plugins.getFileSystemPaths('assets')).toEqual(joinPaths([
        ['node_modules', 'govuk-frontend', 'govuk', 'assets'],
        ['node_modules', 'hmrc-frontend', 'abc'],
        ['node_modules', 'hmrc-frontend', 'def']
      ]))
    })
    it('should lookup scripts paths as file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        scripts: ['/govuk/all.js']
      })
      expect(plugins.getFileSystemPaths('scripts')).toEqual(joinPaths([
        'node_modules/govuk-frontend/govuk/all.js'
      ]))
    })
    it('should not break when asking for an plugin key which isn\'t used', () => {
      expect(plugins.getFileSystemPaths('thisListDoesNotExist')).toEqual([])
    })
  })

  describe('Lookup public URLs', () => {
    it('should show installed plugins asset paths as file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def'],
        pluginDependencies: ['govuk-frontend']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl']
      })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/govuk-frontend/govuk/assets',
        '/plugin-assets/another-frontend/abc',
        '/plugin-assets/another-frontend/def',
        '/plugin-assets/hmrc-frontend/ghi',
        '/plugin-assets/hmrc-frontend/jkl'
      ])
    })
    it('should follow strict alphabetical order', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl']
      })
      expect(plugins.getPublicUrls('assets')).toEqual([
        '/plugin-assets/another-frontend/abc',
        '/plugin-assets/another-frontend/def',
        '/plugin-assets/govuk-frontend/govuk/assets',
        '/plugin-assets/hmrc-frontend/ghi',
        '/plugin-assets/hmrc-frontend/jkl'
      ])
    })
    it('should url encode each part', () => {
      mockPluginConfig('mine', { assets: ['/abc:def'] })

      expect(plugins.getPublicUrls('assets')).toEqual(['/plugin-assets/mine/abc%3Adef'])
    })
  })

  describe('Lookup public URLs with file system paths', () => {
    it('should show installed plugins asset paths as public urls and file system paths', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl'],
        pluginDependencies: ['govuk-frontend']
      })
      expect(plugins.getPublicUrlAndFileSystemPaths('assets')).toEqual([
        {
          publicUrl: '/plugin-assets/another-frontend/abc',
          fileSystemPath: path.join(rootPath, 'node_modules', 'another-frontend', 'abc')
        },
        {
          publicUrl: '/plugin-assets/another-frontend/def',
          fileSystemPath: path.join(rootPath, 'node_modules', 'another-frontend', 'def')
        },
        {
          publicUrl: '/plugin-assets/govuk-frontend/govuk/assets',
          fileSystemPath: path.join(rootPath, 'node_modules', 'govuk-frontend', 'govuk', 'assets')
        },
        {
          publicUrl: '/plugin-assets/hmrc-frontend/ghi',
          fileSystemPath: path.join(rootPath, 'node_modules', 'hmrc-frontend', 'ghi')
        },
        {
          publicUrl: '/plugin-assets/hmrc-frontend/jkl',
          fileSystemPath: path.join(rootPath, 'node_modules', 'hmrc-frontend', 'jkl')
        }
      ])
    })
    it('should follow strict alphabetical order', () => {
      mockPluginConfig('govuk-frontend', {
        assets: ['/govuk/assets']
      })
      mockPluginConfig('another-frontend', {
        assets: ['/abc', '/def']
      })
      mockPluginConfig('hmrc-frontend', {
        assets: ['/ghi', '/jkl']
      })
      expect(plugins.getPublicUrlAndFileSystemPaths('assets')).toEqual([
        {
          publicUrl: '/plugin-assets/another-frontend/abc',
          fileSystemPath: path.join(rootPath, 'node_modules', 'another-frontend', 'abc')
        },
        {
          publicUrl: '/plugin-assets/another-frontend/def',
          fileSystemPath: path.join(rootPath, 'node_modules', 'another-frontend', 'def')
        },
        {
          publicUrl: '/plugin-assets/govuk-frontend/govuk/assets',
          fileSystemPath: path.join(rootPath, 'node_modules', 'govuk-frontend', 'govuk', 'assets')
        },
        {
          publicUrl: '/plugin-assets/hmrc-frontend/ghi',
          fileSystemPath: path.join(rootPath, 'node_modules', 'hmrc-frontend', 'ghi')
        },
        {
          publicUrl: '/plugin-assets/hmrc-frontend/jkl',
          fileSystemPath: path.join(rootPath, 'node_modules', 'hmrc-frontend', 'jkl')
        }
      ])
    })
    it('should url encode each part', () => {
      mockPluginConfig('mine', { assets: ['/abc:def'] })

      expect(plugins.getPublicUrls('assets')).toEqual(['/plugin-assets/mine/abc%3Adef'])
    })
    it('should not break when asking for an plugin key which isn\'t used', () => {
      expect(plugins.getPublicUrls('anotherListThatDoesntExist')).toEqual([])
    })
  })

  describe('getAppViews', () => {
    it('should be a function', () => {
      expect(plugins.getAppViews).toBeInstanceOf(Function)
    })

    it('should output govuk-frontend nunjucks paths as an array', () => {
      mockPluginConfig('govuk-frontend', { nunjucksPaths: '/' })
      expect(plugins.getAppViews()).toEqual(joinPaths([
        'node_modules/govuk-frontend'
      ]))
    })

    it('should also output hmcts-frontend nunjucks paths after it is installed', () => {
      mockPluginConfig('hmcts-frontend', {
        nunjucksPaths: [
          '/my-components',
          '/my-layouts'
        ]
      })
      mockPluginConfig('govuk-frontend', {
        nunjucksPaths: '/'
      })

      expect(plugins.getAppViews()).toEqual(joinPaths([
        'node_modules/hmcts-frontend/my-layouts',
        'node_modules/hmcts-frontend/my-components',
        'node_modules/govuk-frontend'
      ]))
    })

    it('should not output any nunjucks paths when frontends are uninstalled', () => {
      expect(plugins.getAppViews()).toEqual([])
    })

    it('should also output provided paths in the array', () => {
      mockPluginConfig('govuk-frontend', { nunjucksPaths: '/' })
      expect(plugins.getAppViews(joinPaths([
        '/app/views',
        '/lib'
      ]))).toEqual(joinPaths([
        'node_modules/govuk-frontend',
        '/app/views',
        '/lib'
      ]))
    })

    it('should output any provided paths in the array', () => {
      mockPluginConfig('govuk-frontend', { nunjucksPaths: '/' })
      expect(plugins.getAppViews([
        '/my-new-views-directory'
      ])).toEqual([
        path.join(rootPath, 'node_modules/govuk-frontend'),
        '/my-new-views-directory'
      ])
    })
  })

  describe('getAppConfig', () => {
    it('returns an object', () => {
      expect(plugins.getAppConfig()).toBeInstanceOf(Object)
    })

    it('should have script and stylesheet keys', () => {
      expect(Object.keys(plugins.getAppConfig())).toEqual(['scripts', 'stylesheets'])
    })

    it('should return a list of public urls for the scripts', () => {
      mockPluginConfig('govuk-frontend', { scripts: { path: '/govuk/all.js' } })
      expect(plugins.getAppConfig().scripts).toEqual([
        { src: '/plugin-assets/govuk-frontend/govuk/all.js' }
      ])
    })

    it('should return a list of public urls for the stylesheets', () => {
      expect(plugins.getAppConfig().stylesheets).toEqual([])
    })

    it('should include installed plugins where scripts config is a string array', () => {
      mockPluginConfig('govuk-frontend', { scripts: { path: '/govuk/all.js' } })
      mockPluginConfig('my-plugin', { scripts: ['/abc/def/ghi.js'] })
      expect(plugins.getAppConfig().scripts).toEqual([
        { src: '/plugin-assets/govuk-frontend/govuk/all.js' },
        { src: '/plugin-assets/my-plugin/abc/def/ghi.js' }
      ])
    })

    it('should include installed plugins where scripts config is a string', () => {
      mockPluginConfig('my-plugin', { scripts: '/ab/cd/ef/ghi.js' })
      mockPluginConfig('govuk-frontend', { scripts: { path: '/govuk/all.js' } })
      expect(plugins.getAppConfig().scripts).toEqual([
        { src: '/plugin-assets/govuk-frontend/govuk/all.js' },
        { src: '/plugin-assets/my-plugin/ab/cd/ef/ghi.js' }
      ])
    })

    it('should include installed plugins where scripts config is an object including type', () => {
      mockPluginConfig('my-plugin', { scripts: { path: '/ab/cd/ef/ghi.js', type: 'module' } })
      mockPluginConfig('govuk-frontend', { scripts: { path: '/govuk/all.js' } })
      expect(plugins.getAppConfig().scripts).toEqual([
        { src: '/plugin-assets/govuk-frontend/govuk/all.js' },
        { src: '/plugin-assets/my-plugin/ab/cd/ef/ghi.js', type: 'module' }
      ])
    })

    it('should return a list of public urls for the stylesheets', () => {
      expect(plugins.getAppConfig().stylesheets).toEqual([])
    })

    it('should include installed plugins', () => {
      mockPluginConfig('my-plugin', { stylesheets: ['/abc/def/ghi.css'] })
      expect(plugins.getAppConfig().stylesheets).toEqual([
        '/plugin-assets/my-plugin/abc/def/ghi.css'
      ])
    })

    it('should allow core stylesheets and scripts to be passed in', () => {
      mockPluginConfig('my-plugin', { stylesheets: ['/abc/def/ghi.css'], scripts: ['/jkl/mno/pqr.js'] })
      expect(plugins.getAppConfig({ stylesheets: ['/a.css', '/b.css'], scripts: ['/d.js', 'e.js'] })).toEqual({
        stylesheets: [
          '/plugin-assets/my-plugin/abc/def/ghi.css',
          '/a.css',
          '/b.css'
        ],
        scripts: [
          { src: '/plugin-assets/my-plugin/jkl/mno/pqr.js' },
          { src: '/d.js' },
          { src: 'e.js' }
        ]
      })
    })
  })

  describe('error handling', () => {
    it('should cope with keys which aren\'t arrays', () => {
      mockPluginConfig('my-fixable-plugin', { stylesheets: '/abc.css' })
      mockPluginConfig('another-fixable-plugin', { stylesheets: '/abc.css' })

      expect(plugins.getAppConfig().stylesheets).toEqual([
        '/plugin-assets/another-fixable-plugin/abc.css',
        '/plugin-assets/my-fixable-plugin/abc.css'
      ])
    })
    it('should throw if paths use backslashes', () => {
      mockPluginConfig('my-unfixable-plugin', { stylesheets: '\\abc\\def.css' })
      mockPluginConfig('another-fixable-plugin', { stylesheets: ['/abc.css'] })

      const expectedError = new Error('Can\'t use backslashes in plugin paths - "my-unfixable-plugin" used "\\abc\\def.css".')

      expect(() => {
        plugins.getFileSystemPaths('stylesheets')
      }).toThrow(expectedError)

      expect(() => {
        plugins.getPublicUrlAndFileSystemPaths('stylesheets')
      }).toThrow(expectedError)
    })
    it('should throw if paths use backslashes further into the path', () => {
      mockPluginConfig('my-other-unfixable-plugin', { stylesheets: ['/abc\\def.css'] })
      const expectedError2 = new Error('Can\'t use backslashes in plugin paths - "my-other-unfixable-plugin" used "/abc\\def.css".')

      expect(() => {
        plugins.getFileSystemPaths('stylesheets')
      }).toThrow(expectedError2)

      expect(() => {
        plugins.getPublicUrlAndFileSystemPaths('stylesheets')
      }).toThrow(expectedError2)
    })
    it('should throw if it doesn\'t start with a forward slash', () => {
      mockPluginConfig('yet-another-unfixable-plugin', { stylesheets: ['abc.css'] })

      const noLeadingForwardSlashError = new Error('All plugin paths must start with a forward slash - "yet-another-unfixable-plugin" used "abc.css".')

      expect(() => {
        plugins.getFileSystemPaths('stylesheets')
      }).toThrow(noLeadingForwardSlashError)

      expect(() => {
        plugins.getPublicUrlAndFileSystemPaths('stylesheets')
      }).toThrow(noLeadingForwardSlashError)
    })
  })

  const mockInstallPlugin = (packageName, version = '^0.0.1') => {
    const existingPackageJson = JSON.parse(testScope.fileSystem.readFile(['package.json']))
    existingPackageJson.dependencies[packageName] = version
    testScope.fileSystem.writeFile(['package.json'], JSON.stringify(existingPackageJson))
    plugins.setPluginsByType()
  }

  const mockPluginConfig = (packageName, config = {}, version) => {
    testScope.fileSystem.writeFile(['node_modules', packageName, 'govuk-prototype-kit.config.json'], JSON.stringify(config, null, 2))
    mockInstallPlugin(packageName, version)
  }
})
