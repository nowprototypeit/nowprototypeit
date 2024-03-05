const { managementLinks } = require('../../utils')

function getModel (currentSection, req) {
  return {
    links: managementLinks,
    currentSection,
    currentUrl: req.originalUrl
  }
}

module.exports = {
  setupBasicPages: (router) => {
    router.get('/', (req, res) => {
      res.render('index', getModel('Home', req))
    })

    router.get('/clear-data', (req, res) => {
      res.render('clear-data', getModel('Clear session data', req))
    })

    router.post('/clear-data', (req, res) => {
      console.log('clearing data')
      res.redirect(req.originalUrl.split('?')[0] + '-success')
    })

    router.get('/clear-data-success', (req, res) => {
      res.render('clear-data-success', getModel('Clear session data', req))
    })
  }
}
