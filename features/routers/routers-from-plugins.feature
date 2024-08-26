Feature: Routers from plugins

  @no-variant
  Scenario: MPJ Info pages - read more
    Given I have the demo plugin "marsha-p-johnson" installed
    When I visit "/plugin-routes/marsha-p-johnson/info/1"
    Then the main heading should be updated to "Step one"
    When I select the "know-more-yes" radio button
    And I submit the form
    Then the main heading should be updated to "Step two"

  @no-variant
  Scenario: MPJ Info pages - End early
    Given I have the demo plugin "marsha-p-johnson" installed
    When I visit "/plugin-routes/marsha-p-johnson/info/1"
    Then the main heading should be updated to "Step one"
    When I select the "know-more-no" radio button
    And I submit the form
    Then the main heading should be updated to "End"

  @no-variant
  @global-plugin-routes
  @auto-refresh
  Scenario: Prototype routes should override global plugin routes
    Given I have the demo plugin "marsha-p-johnson" installed
    When I visit "/mpj-info/start"
    Then the main heading should be updated to "Welcome to the MPJ plugin pages"
    And I append the file "app/routes.js" with contents "router.get('/mpj-info/start', (req, res) => {res.send('<h1>Hello world</h1>')})"
    Then the main heading should be updated to "Hello world"

  @no-variant
  Scenario: Global plugin routes should be off by default
    Given I have the demo plugin "marsha-p-johnson" installed
    Then I should receive a 404 for page at "/mpj-info/start"

  @no-variant
  Scenario: Prototype routes should not override namespaced plugin routes
    Given I append the file "app/routes.js" with contents "router.get('/plugin-routes/marsha-p-johnson/info/1', (req, res) => {res.send('<h1>Hello world</h1>')})"
    And I have the demo plugin "marsha-p-johnson" installed
    When I visit "/plugin-routes/marsha-p-johnson/info/1"
    Then the main heading should be updated to "Step one"
