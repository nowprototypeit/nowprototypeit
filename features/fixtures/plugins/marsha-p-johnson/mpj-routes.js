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
    console.log({
      nextInfoPageExists,
      userWantsNextPage,
      nextPage
    })
    if (userWantsNextPage && nextInfoPageExists) {
      res.redirect(`${contextPath}/info/${nextPage}`)
    } else {
      res.redirect(`${contextPath}/info/end`)
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

  router.use((req, res, next) => {
    res.status(404).render('/marsha-p-johnson/journey/not-found.njk')
  })
}

module.exports = {
  setupNamespacedRouter
}
