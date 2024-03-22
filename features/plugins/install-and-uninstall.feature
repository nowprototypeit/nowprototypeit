@plugins
Feature: Installing and uninstalling plugins

  @govuk-variant
  @integration
  Scenario: Uninstalled - don't tag as installed
    When I visit the available plugins page
    Then I should see the plugin "jQuery" in the list
    And The "jQuery" plugin should not be tagged as "Installed"

  @integration
  @no-variant
  Scenario: Installed - tag as installed
    Given I install the "npm:jquery" plugin
    When I visit the available plugins page
    Then I should see the plugin "jQuery" in the list
    And The "jQuery" plugin should be tagged as "Installed"

  @govuk-variant
  @integration
  Scenario: Uninstalled - hide on installed plugins
    Given I try to uninstall the "installed:@govuk-prototype-kit/common-templates" plugin
    And I continue with the uninstall
    When I visit the installed plugins page
    Then I should not see the plugin "Common Templates" in the list

  @no-variant
  Scenario: Installed - show on installed plugins
    Given I install the "npm:jquery" plugin
    When I visit the installed plugins page
    Then I should see the plugin "jQuery" in the list
