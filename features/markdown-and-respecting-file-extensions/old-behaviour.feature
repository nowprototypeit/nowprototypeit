Feature: Not respecting file extensions when experiment is off

  @no-variant
  @nunjucks
  Scenario Outline: Not respecting file extensions of page views when experiment is off
    Given I create a file "app/views/fixture-example.<fileExtension>" based on the fixture file "nunjucks/really-basic-page.njk"
    When I visit "/fixture-example"
    Then the main heading should be updated to "3 + 5 = 8"
    Examples:
      | fileExtension |
      | njk           |
      | html          |

  @no-variant
  @nunjucks
  Scenario Outline: Fuzzy matching file extensions of includes when experiment is off
    Given I create a file "app/views/fixture-example.<pageFileExtension>" based on the fixture file "nunjucks/page-with-really-basic-include.njk"
    And I create a file "app/views/includes/really-basic-example.<actualFileExtension>" based on the fixture file "nunjucks/really-basic-include.njk"
    And I replace "__your__file__path__here__" with "includes/really-basic-example.<usedFileExtension>" in the file "app/views/fixture-example.<pageFileExtension>"
    When I visit "/fixture-example"
    Then the main heading should be updated to "4 + 6 = 10"
    Examples:
      | actualFileExtension | usedFileExtension | pageFileExtension |
      | njk                 | njk               | njk               |
      | html                | njk               | njk               |
      | njk                 | html              | njk               |
      | html                | html              | njk               |
      | njk                 | njk               | html              |
      | html                | njk               | html              |
      | njk                 | html              | html              |
      | html                | html              | html              |
