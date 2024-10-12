@todo-example-app
@plugin-routers
Feature: Persistence in routers

  @npi-variant
  Scenario: Todo app without persistence
    And I create a file "app/views/todo/get.njk" based on the fixture file "nunjucks/todo-page.njk"
    Given I replace the file "app/routes.js" based on the fixture file "routes/todo-routes-without-persistence_js"
    And I wait for the prototype to reload
    When I visit "/todo"
    And the main heading should be updated to "No items in todo or done"
    And I enter "Something" into the "name" field
    And I submit the form with ID "add-item"
    And the main heading should be updated to "To do:"
    Then the list with ID "todo-items" should contain an item which starts with text "Something"
    And I delete the file "app/routes.js"
    And I wait for the prototype to reload
    And I replace the file "app/routes.js" based on the fixture file "routes/todo-routes-without-persistence_js"
    And I wait for the prototype to reload
    And the main heading should be updated to "No items in todo or done"

  @npi-variant
  Scenario: Todo app with persistence
    And I create a file "app/views/todo/get.njk" based on the fixture file "nunjucks/todo-page.njk"
    Given I replace the file "app/routes.js" based on the fixture file "routes/todo-routes-with-persistence_js"
    And I wait for the prototype to reload
    When I visit "/todo"
    And the main heading should be updated to "No items in todo or done"
    And I enter "Something" into the "name" field
    And I submit the form with ID "add-item"
    And the main heading should be updated to "To do:"
    Then the list with ID "todo-items" should contain an item which starts with text "Something"
    And I delete the file "app/routes.js"
    And I wait for the prototype to reload
    And I replace the file "app/routes.js" based on the fixture file "routes/todo-routes-with-persistence_js"
    And I wait for the prototype to reload
    And the main heading should be updated to "To do:"
    Then the list with ID "todo-items" should contain an item which starts with text "Something"
