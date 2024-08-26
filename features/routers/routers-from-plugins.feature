Feature: Routers from plugins

  @no-variant
  Scenario: MPJ Info pages - read more
    Given I have the demo plugin "marsha-p-johnson" installed
    When I visit "/plugin-routes/marsha-p-johnson/info/1"
    Then the main heading should be updated to "Step one"
    When I select the "know-more-yes" radio button
    And I submit the form
    Then the main heading should be updated to "Step two"

  @no-variant
  Scenario: MPJ Info pages - End early
    Given I have the demo plugin "marsha-p-johnson" installed
    When I visit "/plugin-routes/marsha-p-johnson/info/1"
    Then the main heading should be updated to "Step one"
    When I select the "know-more-no" radio button
    And I submit the form
    Then the main heading should be updated to "End"
