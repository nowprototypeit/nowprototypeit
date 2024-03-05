@routes
Feature: Routes

  Scenario: Custom get route
    Given I append the file "app/routes.js" with contents "router.get('/hello/:name', function (req, res) {res.send('<h1>hello ' + req.params.name + '</h1>')})"
    When I visit "/hello/world"
    Then the main heading should be updated to "hello world"
    When I visit "/hello/you"
    Then the main heading should be updated to "hello you"

  @auto-reload
  Scenario: Custom get route
    Given I visit "/example2"
    Then the main heading should be updated to "Page not found"
    When I append the file "app/routes.js" with contents "router.get('/example2', function (req, res) {res.send('<h1>hello example 2 - part 1</h1>')})"
    Then the main heading should be updated to "hello example 2 - part 1"
    When I replace "hello example 2 - part 1" with "hello example 2 - part 2" in the file "app/routes.js"
    Then the main heading should be updated to "hello example 2 - part 2"