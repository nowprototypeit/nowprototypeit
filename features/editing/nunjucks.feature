@nunjucks
Feature: Nunjucks editing

  @auto-refresh
  Scenario: Auto refresh when creating a new page
    Given I am viewing a 404 page at "/abc/def/ghi/jkl"
    When I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    Then the main heading should be updated to "Hello world"

  @auto-refresh
  Scenario: Auto refresh when deleting a page
    Given I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    When I visit "/abc/def/ghi/jkl"
    Then the main heading should be updated to "Hello world"
    When I delete the file "app/views/abc/def/ghi/jkl.njk"
    Then the main heading should be updated to "Page not found"
    And I am viewing a 404 page at "/abc/def/ghi/jkl"

  @auto-refresh
  Scenario: Auto refresh when updating a page
    Given I create a file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Hello world</h1>"
    When I visit "/abc/def/ghi/jkl"
    Then the main heading should be updated to "Hello world"
    When I update the file "app/views/abc/def/ghi/jkl.njk" with contents "<h1>Update successful</h1>"
    Then the main heading should be updated to "Update successful"

  Scenario: Layouts and components from plugins
    Given I have the demo plugin "marsha-p-johnson" installed
    And I create a file "app/views/example.njk" based on the fixture file "nunjucks/mpj-example.njk"
    When I visit "/example"
    Then the main heading should read "Marsha P. Johnson"
    