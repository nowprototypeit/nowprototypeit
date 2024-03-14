@plugins
Feature: Handle plugin update
    
    Scenario: When a dependency is now required
      Given I install the "npm:govuk-frontend" plugin
      And I install the "npm:@govuk-prototype-kit/common-templates:1.1.1" plugin
      And I uninstall the "govuk-frontend" plugin using the console
      When I visit the installed plugins page
      Then I should not see the plugin "GOV.UK Frontend" in the list
      When I try to update the "installed:@govuk-prototype-kit/common-templates" plugin
      Then I should be informed that "GOV.UK Frontend" will also be installed
      When I continue with the update
      And I visit the installed plugins page
      Then I should see the plugin "Common Templates" in the list
      And I should see the plugin "GOV.UK Frontend" in the list

      
