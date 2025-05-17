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
  Given Hosting is disabled for this version of the kit with message "This **should** be *formatted* and can include links (link:/manage-prototype/plugin/npm:nowprototypeit)"
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "This should be formatted and can include links /manage-prototype/plugin/npm:nowprototypeit"
  And the page should contain bold text saying "should"
  And the page should contain italic text saying "formatted"
  And the page should contain a link with URL and text of "/manage-prototype/plugin/npm:nowprototypeit"

@no-variant
@hosting-experiment-on
Scenario: Incompatible version with a different message
  Given Hosting is disabled for this version of the kit with message "Basic message"
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "Basic message"
