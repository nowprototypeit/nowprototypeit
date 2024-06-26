const path = require('path')
const { Environment } = require('nunjucks')
const NunjucksLoader = require('./nunjucksLoader')
const { stopWatchingNunjucks } = NunjucksLoader
const { startPerformanceTimer, endPerformanceTimer } = require('../utils/performance')

function getNunjucksAppEnv (appViews) {
  const nunjucksViews = [...appViews]

  return new Environment(new NunjucksLoader(nunjucksViews))
}

function expressNunjucks (env, app) {
  function NunjucksView (name, opts) {
    this.name = name
    this.path = name
    this.defaultEngine = opts.defaultEngine
    this.ext = path.extname(name)
    if (!this.ext && !this.defaultEngine) {
      throw new Error('No default engine was specified and no extension was provided.')
    }
  }

  NunjucksView.prototype.render = function render (opts, cb) {
    const timer = startPerformanceTimer()
    try {
      env.render(this.name, opts, function () {
        cb.apply(null, arguments)
        endPerformanceTimer('NunjucksView.render', timer)
      })
    } catch (e) {
      return cb(e)
    }
  }

  app.set('view', NunjucksView)
  app.set('nunjucksEnv', env)
  return env
}

module.exports = { NunjucksLoader, getNunjucksAppEnv, expressNunjucks, stopWatchingNunjucks }
