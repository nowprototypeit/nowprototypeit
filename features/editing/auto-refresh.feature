@nunjucks
@auto-refresh
@no-variant
Feature: Nunjucks editing

  Scenario: Keeping state when auto-refreshing
    Given I create a file "app/views/example.njk" based on the fixture file "nunjucks/complex-form.njk"
    And I visit "/example"
    And the main heading should be updated to "State info"
    And I submit the form
    Then the page should include a paragraph that reads "text:"
    Then the page should include a paragraph that reads "checkboxes: empty"
    Then the page should include a paragraph that reads "radio: empty"
    When I enter "Some text" into the "text" field
    And I select the "abc" checkbox
    And I select the "def" checkbox
    And I select the "pqr" radio button
    When I append the file "app/views/example.njk" with contents "<p>Triggering refresh 1</p>"
    Then the page should include a paragraph that reads "Triggering refresh 1"
    Then the page should include a paragraph that reads "text:"
    Then the page should include a paragraph that reads "checkboxes: empty"
    Then the page should include a paragraph that reads "radio: empty"
    When I click the button with text "Submit"
    Then the page should include a paragraph that reads "text: Some text"
    And the page should include a paragraph that reads "checkboxes: abc, def"
    And the page should include a paragraph that reads "radio: pqr"
