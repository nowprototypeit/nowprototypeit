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

  @no-variant
  Scenario: Provide generic install button for a plugin that's not installed
    Given I view the plugin details for the "npm:govuk-frontend:5.10.1" plugin
    Then I should see the "Install" button
    And I should not see the "Uninstall" button
    And I should not see the "Install this version" button
    And I should not see the "Update" button

  @govuk-variant
  Scenario: Provide specific install button for a plugin where a different version number is installed
    Given I view the plugin details for the "npm:@govuk-prototype-kit/common-templates:2.0.0" plugin
    Then I should see the "Install this version" button
    And I should see the "Uninstall" button
    And I should not see the "Install" button
    And I should not see the "Update" button

  @govuk-variant
  Scenario: Provide specific install button for a plugin where a different version is installed (even if the version numbers match)
    Given I view the plugin details for the "github:alphagov:govuk-prototype-kit-common-templates:main" plugin
    Then I should see the "Install this version" button
    And I should see the "Uninstall" button
    And I should not see the "Install" button
    And I should not see the "Update" button

  @govuk-variant
  @integration
  Scenario: Only provide uninstall when the version exactly matches (will fail if new common templates version is released)
    Given I view the plugin details for the "npm:@govuk-prototype-kit/common-templates:2.0.1" plugin
    Then I should see the "Uninstall" button
    And I should not see the "Install this version" button
    And I should not see the "Install" button
    And I should not see the "Update" button

  @no-variant
  Scenario: Don't encourage the user to uninstall nowprototypeit
    Given I view the plugin details for the "npm:nowprototypeit" plugin
    Then I should see the "Install this version" button
    And I should not see the "Uninstall" button
    And I should not see the "Install" button
    And I should not see the "Update" button
