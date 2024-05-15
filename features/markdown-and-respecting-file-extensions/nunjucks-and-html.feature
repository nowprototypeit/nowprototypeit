Feature: Not respecting file extensions when experiment is off

  @no-variant
    @respect-file-extensions-experiment-on
    @nunjucks
  Scenario Outline: Respecting file extensions of pages when experiment is on
    Given I create a file "app/views/fixture-example.<fileExtension>" based on the fixture file "nunjucks/really-basic-page.njk"
    When I visit "/fixture-example"
    Then the main heading should be updated to "3 + 5 = <answer>"
    Examples:
      | fileExtension | answer      |
      | njk           | 8           |
      | html          | {{ 3 + 5 }} |

  @no-variant
    @respect-file-extensions-experiment-on
    @nunjucks
  Scenario Outline: Respecting file extensions of includes when experiment is on
    Given I create a file "app/views/fixture-example.njk" based on the fixture file "nunjucks/page-with-really-basic-include.njk"
    And I create a file "app/views/includes/really-basic-example.<actualFileExtension>" based on the fixture file "nunjucks/really-basic-include.njk"
    And I replace "__your__file__path__here__" with "includes/really-basic-example.<usedFileExtension>" in the file "app/views/fixture-example.njk"
    When I visit "/fixture-example"
    Then the main heading should be updated to "4 + 6 = <answer>"
    Examples:
      | actualFileExtension | usedFileExtension | answer      |
      | njk                 | njk               | 10          |
      | html                | html              | {{ 4 + 6 }} |


  @no-variant
  @respect-file-extensions-experiment-on
  @nunjucks
  Scenario: Should not use fuzzy finding when experiment is on, it should error instead
    Given I create a file "app/views/fixture-example.njk" based on the fixture file "nunjucks/page-with-really-basic-include.njk"
    And I create a file "app/views/includes/really-basic-example.njk" based on the fixture file "nunjucks/really-basic-include.njk"
    And I replace "__your__file__path__here__" with "includes/really-basic-example.html" in the file "app/views/fixture-example.njk"
    When I visit "/fixture-example"
    Then I should see an error page
    And the error details should contain "File path" "app/views/fixture-example.njk"
    And the error details should contain "Error type" "Template render error"
    And the error details should contain "template not found" "includes/really-basic-example.html"
