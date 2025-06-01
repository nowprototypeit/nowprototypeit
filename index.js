// local dependencies
const filtersApi = require('./lib/filters/api').external
const functionsApi = require('./lib/functions/api').external
const routesApi = require('./lib/routes/api').external
const persistenceApi = require('./lib/persistence/api').external
const configApi = require('./lib/config.js').external

module.exports = {
  requests: routesApi,
  views: { ...filtersApi, ...functionsApi },
  persistence: persistenceApi,
  config: configApi
}
