@templates
Feature: Templates

  @mpj-variant
  Scenario: Create link on 404 page
    And I am viewing a 404 page at "/this/page/does-not/exist"
    When I click the link with text "create this page using a template"
    And I choose the "The first pride was a riot" template from the "Marsha P Johnson" plugin
    And I submit the form
    And I visit "/this/page/does-not/exist"
    Then the page title should become "The first pride was a riot"
