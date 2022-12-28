const { waitForApplication } = require('../../utils')
const path = require('path')

const appViews = path.join(Cypress.env('projectFolder'), 'app', 'views')
const pluginFooBarView = path.join(appViews, 'plugin-foo-bar.html')

const WHITE = 'rgb(255, 255, 255)'
const RED = 'rgb(255, 0, 0)'
const GREEN = 'rgb(0, 255, 0)'
const YELLOW = 'rgb(255, 255, 0)'
const BLUE = 'rgb(0, 0, 255)'

const pluginFooBarSeparatedViewMarkup = `
{% extends "layouts/main.html" %}

{% block content %}
{% include "bar.njk" %}
{% include "foo.njk" %}
{% endblock %}

{% block pageScripts %}
<script>
  window.GOVUKPrototypeKit.documentReady(() => {
    new window.FOO.Modules.PluginFoo('.test-foo')
    new window.BAR.Modules.PluginBar('.test-bar')
  })
</script>
{% endblock %}
`

describe('Plugins test', async () => {
  before(() => {
    waitForApplication()
    cy.task('createFile', { filename: pluginFooBarView, data: pluginFooBarSeparatedViewMarkup })
  })

  after(() => {
    // clean up
    cy.task('deleteFile', { filename: pluginFooBarView })
  })

  describe('Plugin Bar', () => {
    it('Loads plugin-bar view correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-bar')
        .should('contains.text', 'Plugin Bar')
    })

    it('Loads plugin-bar style correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-bar')
        .should('have.css', 'background-color', RED)
        .should('have.css', 'border-color', GREEN)
    })

    it('Loads plugin-bar script correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-bar').click()
      cy.get('.plugin-bar').should('have.css', 'background-color', GREEN)
        .should('have.css', 'border-color', RED)
    })
  })

  describe('Plugin Foo', () => {
    it('Loads plugin-foo view correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-foo')
        .should('contains.text', 'Plugin Foo')
    })

    it('Loads plugin-foo style correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-foo')
        .should('have.css', 'background-color', YELLOW)
        .should('have.css', 'border-color', WHITE)
    })

    it('Loads plugin-foo script correctly', () => {
      cy.visit('/plugin-foo-bar')
      cy.get('.plugin-foo').click()
      cy.get('.plugin-foo')
        .should('have.css', 'background-color', BLUE)
        .should('have.css', 'border-color', WHITE)
    })
  })
})
