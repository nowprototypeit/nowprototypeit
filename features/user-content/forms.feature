Feature: Forms

  @no-variant
  Scenario: Form with GET action
    Given I create a file "app/views/form.html" based on the fixture file "html/form-with-get-action.html"
    And I create a file "app/views/form-receiver.html" based on the fixture file "nunjucks/form-receiver.njk"
    And I visit "/form-receiver"
    And the main heading should be updated to "You entered:"
    When I visit "/form"
    And I enter "Hey, this is the test" into the "example" field
    And I submit the form
    And I visit "/form-receiver"
    Then the main heading should be updated to "You entered: Hey, this is the test"

  @no-variant
  Scenario: Form with POST action
    Given I create a file "app/views/form.html" based on the fixture file "html/form-with-post-action.html"
    And I create a file "app/views/form-receiver.html" based on the fixture file "nunjucks/form-receiver.njk"
    And I visit "/form-receiver"
    And the main heading should be updated to "You entered:"
    When I visit "/form"
    And I enter "This is from a post" into the "example" field
    And I submit the form
    And I visit "/form-receiver"
    Then the main heading should be updated to "You entered: This is from a post"

  @no-variant
  @smoke
  Scenario: Legacy data variable working the same as userInput variable
    Given I create a file "app/views/form.html" based on the fixture file "html/form-with-post-action.html"
    And I create a file "app/views/form-receiver.html" based on the fixture file "nunjucks/form-receiver-legacy.njk"
    And I visit "/form-receiver"
    And the main heading should be updated to "You entered:"
    When I visit "/form"
    And I enter "This is from a post" into the "example" field
    And I submit the form
    And I visit "/form-receiver"
    Then the main heading should be updated to "You entered: This is from a post"
    When I clear my session data
    And I visit "/form-receiver"
    And the main heading should be updated to "You entered:"
