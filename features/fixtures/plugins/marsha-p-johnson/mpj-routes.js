const infoPages = {
  1: {
    writtenNumber: 'one',
    info: 'Marsha P. Johnson was born on August 24, 1945, in Elizabeth, New Jersey.',
    next: 2
  },
  2: {
    writtenNumber: 'two',
    info: 'Marsha P. Johnson was a prominent figure in the LGBTQ+ rights movement.',
    next: 3
  },
  3: {
    writtenNumber: 'three',
    info: 'Marsha was one of the prominent figures in the Stonewall uprising of 1969.'
  }
}

function setupNamespacedRouter (router, { contextPath }) {
  router.get('/hello', (req, res) => {
    res.send({ hello: req.query.who || 'world' })
  })

  router.post('/navigator', (req, res) => {
    const currentPage = parseInt(req.body['current-page'], 10)
    const nextPage = currentPage + 1
    const nextInfoPageExists = infoPages[nextPage]
    const userWantsNextPage = req.body.knowMore === 'yes'
    const userDoesntWantToKnowMore = req.body.knowMore === 'no'
    console.log({
      nextInfoPageExists,
      userWantsNextPage,
      userDoesntWantToKnowMore,
      nextPage
    })
    if (userWantsNextPage && nextInfoPageExists) {
      res.redirect(`${contextPath}/info/${nextPage}`)
    } else if (userDoesntWantToKnowMore) {
      res.redirect(`${contextPath}/info/end`)
    } else {
      res.redirect(`${contextPath}/info/no-selection-made`)
    }
  })

  router.get('/info/:pageNumber', (req, res, next) => {
    const pageNumber = parseInt(req.params.pageNumber, 10)
    const pageInfo = infoPages[pageNumber]
    if (pageInfo) {
      return res.render('/marsha-p-johnson/journey/step.njk', {
        pageNumber,
        navigatorFormHandlerUrl: `${contextPath}/navigator`,
        endPageURL: `${contextPath}/info/end`,
        ...pageInfo
      })
    }
    next()
  })

  router.get('/info/end', (req, res, next) => {
    res.render('/marsha-p-johnson/journey/end.njk')
  })
  router.get('/info/no-selection-made', (req, res, next) => {
    res.render('/marsha-p-johnson/journey/no-selection-made.njk')
  })

  router.use((req, res, next) => {
    res.status(404).render('/marsha-p-johnson/journey/not-found.njk')
  })
}
function setupGlobalRouter (router) {
  router.get('/mpj-info/start', (req, res) => {
    res.send('<h1>Welcome to the MPJ plugin pages</h1><p><a href="/plugin-routes/marsha-p-johnson/info/1">Start the journey</a></p>')
  })
}

module.exports = {
  setupNamespacedRouter,
  setupGlobalRouter
}
