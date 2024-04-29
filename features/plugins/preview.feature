Feature:

  @integration
  @no-variant
  Scenario: Plugin details from NPM
    When I view the plugin details for the "npm:govuk-frontend:5.3.1" plugin
    Then the page title should become "Plugins - Manage your prototype - Now Prototype It"
    And the main heading should read "GOV.UK Frontend"
    And the page should include a paragraph that reads "GOV.UK Frontend contains the code you need to start building a user interface for government platforms and services."
