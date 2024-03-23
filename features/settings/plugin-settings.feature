Feature: Plugin settings

  @govuk-variant
  Scenario: Service name from homepage
    Given I am on the plugin settings page for the "GOV.UK Frontend Adaptor" plugin
    When I fill in "serviceName" with "An example service"
    And I press "Save changes"
    And I wait for the prototype to reload
    Then I should see the settings saved message
    When I visit the homepage
    Then I should see "An example service" as the service name in the GOV.UK header

  @govuk-variant
  Scenario: GOV.UK Global styles
    Given I create a file "app/views/style-example.njk" based on the fixture file "nunjucks/global-style-example.njk"
    When I visit "/style-example"
    Then the first paragraph margin top should become "0px"
    When I am on the plugin settings page for the "GOV.UK Frontend Adaptor" plugin
    And I turn off the "globalGOVUKStyles" setting
    And I press "Save changes"
    Then I should see the settings saved message
    When I visit "/style-example"
    Then the first paragraph margin top should become "10px"
