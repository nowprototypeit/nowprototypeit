@no-variant
Feature: Messages from the API

  Scenario: Read a messages from the API
    Given the API contains a message for this version of the kit with text "Hello, and welcome"
    And I fully restart my prototype
    When I visit the manage prototype homepage
    Then I should only see the message "Hello, and welcome"

  Scenario: Pass on HTML elements as text
    Given the API contains a message for this version of the kit with text "<p>This is a message <script>window.location.href='https://example.com'</script> from the API, it's used for communicating known issues with older versions.</p>"
    And I fully restart my prototype
    When I visit the manage prototype homepage
    Then I should only see the message "<p>This is a message <script>window.location.href='https://example.com'</script> from the API, it's used for communicating known issues with older versions.</p>"

  Scenario: No API messages by default
    When I visit the manage prototype homepage
    Then I should not see any messages

  Scenario: Allow styled content from the API
    Given the API contains a message for this version of the kit with text "This is a **MAJOR** *security issue* with the prototype kit **please**, update as soon as you can.  You can do that by visiting (link:/manage-prototype/plugin/npm:nowprototypeit)."
    And I fully restart my prototype
    When I visit the manage prototype homepage
    Then I should only see the message "This is a MAJOR security issue with the prototype kit please, update as soon as you can.  You can do that by visiting /manage-prototype/plugin/npm:nowprototypeit."
    And the first message should contain bold text saying "MAJOR"
    And the first message should contain bold text saying "please"
    And the first message should contain italic text saying "security issue"
    And the first message should contain a link to "/manage-prototype/plugin/npm:nowprototypeit"
