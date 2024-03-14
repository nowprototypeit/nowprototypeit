@plugins
Feature: Installing and uninstalling plugins

  Scenario: Uninstalled - don't tag as installed
    When I visit the available plugins page
    Then I should see the plugin "Common Templates" in the list
    And The "Common Templates" plugin should not be tagged as "Installed"

  @integration
  Scenario: Installed - tag as installed
    Given I install the "npm:govuk-frontend" plugin
    Given I install the "npm:@govuk-prototype-kit/common-templates" plugin
    When I visit the available plugins page
    Then I should see the plugin "GOV.UK Frontend" in the list
    And The "GOV.UK Frontend" plugin should be tagged as "Installed"

  Scenario: Uninstalled - hide on installed plugins
    When I visit the installed plugins page
    Then I should not see the plugin "Common Templates" in the list

  Scenario: Installed - show on installed plugins
    Given I install the "npm:govuk-frontend" plugin
    When I visit the installed plugins page
    Then I should see the plugin "GOV.UK Frontend" in the list

  @nunjucks
  @integration
  Scenario: govuk-frontend fallback
    Given I have the "GOV.UK Frontend" ("npm:govuk-frontend") plugin installed
    And I have the "Common Templates" ("npm:@govuk-prototype-kit/common-templates") plugin installed
    Given I create a file "/app/views/index.njk" based on the fixture file "nunjucks/gpk-homepage.njk"
    Given I try to uninstall the "installed:govuk-frontend" plugin
    And I continue with the uninstall
    When I visit "/"
    Then the page title should read "Home - Service name goes here - GOV.UK"
    And the main heading should read "Service name goes here"
    And there should be an "h4" element with the text "It looks like GOV.UK Frontend isn't installed"

