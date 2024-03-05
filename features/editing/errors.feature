@errors
Feature: Error handling
  
  @nunjucks
  Scenario: Template error
    Given I create a file "app/views/broken-example.njk" based on the fixture file "nunjucks/broken/no-brace-on-block.njk"
    When I visit "/broken-example"
    Then the main heading should be updated to "There was an error while loading your page"
    Then the page title should read "Error displaying your page – Now Prototype It"
    Then I should see an error page
    And the error details should contain "File path:" "app/views/broken-example.njk"
    And the error details should contain "Line number:" "21387"
    And the error details should contain "Column number:" "3"
    And the error details should contain "Error type:" "Template render error"
    And the error details should contain "Error message:" "expected block end in block statement"
    And the source code should start at line 72
    And the source code should end at line 102
    And only line 87 should be highlighted

  @nunjucks
  Scenario: Template error
    Given I create a file "app/views/abc/def/ghi/missing-layout.njk" based on the fixture file "nunjucks/broken/nonexistent-layout.njk"
    When I visit "/abc/def/ghi/missing-layout"
    Then the main heading should be updated to "There was an error while loading your page"
    Then the page title should read "Error displaying your page – Now Prototype It"
    Then I should see an error page
    And the error details should contain "Error type:" "template not found: layouts/this-does-not-exist.html"
    And the error details should contain additional information starting with "The following directories were checked:"
    And the source code should start at line 1
    And the source code should end at line 6
