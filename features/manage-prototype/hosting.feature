Feature: Hosting

@no-variant
@hosting-experiment-on
Scenario: Hosting message
  Given Hosting is enabled for this version of the kit with logged out message "This is *an example* **from the fake API**. The format was introduced in (link:https://github.com/nowprototypeit/nowprototypeit/pull/87)."
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "This is an example from the fake API. The format was introduced in https://github.com/nowprototypeit/nowprototypeit/pull/87."
  And the page should contain bold text saying "from the fake API"
  And the page should contain italic text saying "an example"
  And the page should contain a link with URL and text of "https://github.com/nowprototypeit/nowprototypeit/pull/87"

@no-variant
@hosting-experiment-on
Scenario: Hosting page with a different message
  Given Hosting is enabled for this version of the kit with logged out message "Basic text"
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

  @no-variant
  @hosting-experiment-on
  Scenario: Hosting page with a different message and no prototypes
    Given Hosting is enabled for this version of the kit with logged out message "Basic text"
    And the fake api expects a login from "nowprototypeit" with 0/0 prototypes used
    When I visit "/manage-prototype/hosting"
    And I click the button with text "Log in"
    Then the main heading should be updated to "A login window should have opened"
    When I login with username as "nowprototypeit" in the fake website popup window
    Then the main heading should be updated to "You're in the process of logging in"
    When I enter the one-time-password as "1234" in the fake website popup window
    Then the popup window should be closed
    And the page should include a paragraph that reads "Your account is not set up for uploading prototypes, to set this up please visit your profile on the Now Prototype It website."
    And the username on the page should be "nowprototypeit"

  @no-variant
  @hosting-experiment-on
  Scenario: Hosting page when the user has upload capacity
    Given Hosting is enabled for this version of the kit with logged out message "Basic text"
    And the fake api expects a login from "nowprototypeit" with 2/3 prototypes used
    When I visit "/manage-prototype/hosting"
    And I click the button with text "Log in"
    Then the main heading should be updated to "A login window should have opened"
    When I login with username as "nowprototypeit" in the fake website popup window
    Then the main heading should be updated to "You're in the process of logging in"
    When I enter the one-time-password as "1234" in the fake website popup window
    Then the popup window should be closed
    And the main heading should read "Upload your prototype to Now Prototype It's hosting platform"
    And the page should include a paragraph that reads "You can upload 1 more prototype. If this isn't enough please visit your profile on the Now Prototype It website where you can remove unused prototypes or increase your limit."
    And the username on the page should be "nowprototypeit"
