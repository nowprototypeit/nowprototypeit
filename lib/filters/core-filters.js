// local dependencies
const { runWhenEnvIsAvailable, external } = require('./api')
const { addFilter, getFilter } = external

runWhenEnvIsAvailable(() => {
  const nunjucksSafe = getFilter('safe')

  addFilter(
    'log',
    /**
     * Logs an object in the template to the console in the browser.
     *
     * @example
     * ```njk
     * {{ "hello world" | log }}
     * ```
     * @param {any} a - any type
     * @returns {string} a script tag with a console.log call.
     */
    (a) => nunjucksSafe('<script>console.log(' + JSON.stringify(a, null, '\t') + ');</script>')
  )
})
