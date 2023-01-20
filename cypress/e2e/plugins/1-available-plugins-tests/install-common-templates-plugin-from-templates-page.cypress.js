const { waitForApplication, uninstallPlugin } = require('../../utils')

const manageTemplatesPagePath = '/manage-prototype/templates'
const panelCompleteQuery = '[aria-live="polite"] #panel-complete'
const plugin = '@govuk-prototype-kit/common-templates'

async function loadTemplatesPage () {
  cy.task('log', 'Visit the manage prototype templates page')
  await waitForApplication(manageTemplatesPagePath)
}

describe('Install common templates from templates page', () => {
  before(() => {
    uninstallPlugin(plugin)
    cy.wait(4000)
  })

  it('install', () => {
    loadTemplatesPage()
    cy.get('a').contains('Install common templates').click()

    cy.get(panelCompleteQuery, { timeout: 20000 })
      .should('be.visible')

    cy.get('a').contains('Templates').click()

    cy.get(`[data-plugin-package-name="${plugin}"]`).contains('Common Templates')

    cy.get('a.govuk-button').should('not.exist')
  })
})
