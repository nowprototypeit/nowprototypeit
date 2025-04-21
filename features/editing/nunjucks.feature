@nunjucks
Feature: Nunjucks editing

  @no-variant
  @auto-refresh
  Scenario: Auto refresh when creating a new page
    Given I am viewing a 404 page at "/this/page/should/not/exist/at/the/start/of/the/test"
    When I create a file "app/views/this/page/should/not/exist/at/the/start/of/the/test.njk" with contents "<h1>Hello world</h1>"
    Then the main heading should be updated to "Hello world"

  @no-variant
  @auto-refresh
  Scenario: Auto refresh when deleting a page
    Given I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    When I visit "/abc/def/ghi/jkl"
    Then the main heading should be updated to "Hello world"
    When I delete the file "app/views/abc/def/ghi/jkl.njk"
    Then the main heading should be updated to "Page not found"
    And I am viewing a 404 page at "/abc/def/ghi/jkl"
    When I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    Then the main heading should be updated to "Hello world"

  @no-variant
  @auto-refresh
  Scenario: Auto refresh when updating a page
    Given I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    When I visit "/abc/def/ghi/jkl"
    Then the main heading should be updated to "Hello world"
    When I update the file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Update successful</h1>"
    Then the main heading should be updated to "Update successful"

  @no-variant
  Scenario: Layouts and components from plugins
    Given I have the demo plugin "marsha-p-johnson" installed
    And I create a file "app/views/example.njk" based on the fixture file "nunjucks/mpj-example.njk"
    When I visit "/example"
    Then the main heading should be updated to "Marsha P. Johnson"
