Feature: Hosting

@no-variant
@hosting-experiment-on
Scenario: Hosting message
  Given Hosting is enabled for this version of the kit with logged out message "<p>This is an example <strong>from the fake API</strong>.</p>"
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "This is an example from the fake API."

@no-variant
@hosting-experiment-on
Scenario: Hosting page with a different message
  Given Hosting is enabled for this version of the kit with logged out message "<p>Basic text</p>"
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "Basic text"

@no-variant
@hosting-experiment-on
Scenario: Incompatible version
  Given Hosting is disabled for this version of the kit with message "<p>Please <a href='/'>update your kit</a> to use the hosting platform.</p>"
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "Please update your kit to use the hosting platform."
