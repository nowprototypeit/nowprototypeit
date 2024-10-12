// local dependencies
const filtersApi = require('./lib/filters/api').external
const functionsApi = require('./lib/functions/api').external
const routesApi = require('./lib/routes/api').external
const percistenceApi = require('./lib/persistence/api').external
const markdownRenderersApi = require('./lib/markdownRenderers/api').external

module.exports = {
  requests: routesApi,
  views: { ...filtersApi, ...functionsApi, ...markdownRenderersApi },
  persistence: percistenceApi
}
