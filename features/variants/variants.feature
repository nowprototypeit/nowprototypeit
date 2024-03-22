@variants
Feature: Testing variants that only exist for these tests

  @govuk-variant
  Scenario: Latest versions installed
    When I visit the installed plugins page
    Then all my plugins should be on the latest version

  @no-variant
  Scenario: Baseline, no variant
    Then I should have no plugins installed
    And my project should be set up to use git
    And the file "app/routes.js" should contain "https://docs.nowprototype.it/(kit_version)/routers/create-routes"

  @mpj-variant
  Scenario: Marsha P Johnson variant, built in view
    Then I should have no plugins installed
    And my project should be set up to use git
    And the file "app/routes.js" should contain "https://docs.nowprototype.it/(kit_version)/routers/create-routes"
    When I visit '/hello-world'
    Then the main heading should read "Hello world"
    And I uninstall the "installed:marsha-p-johnson" plugin

  @mpj-variant
  Scenario: Marsha P Johnson variant, built in view
    Then I should have no plugins installed
    And my project should be set up to use git
    And the file "app/routes.js" should contain "https://docs.nowprototype.it/(kit_version)/routers/create-routes"
    When I visit '/hello-world'
    Then the main heading should read "Hello world"
    And I uninstall the "installed:marsha-p-johnson" plugin

  @no-variant
  Scenario: Baseline, no variant
    Then I should have no plugins installed
    And my project should be set up to use git
    And the file "app/routes.js" should contain "https://docs.nowprototype.it/(kit_version)/routers/create-routes"
