@no-variant
Feature: Messages from the API

  Scenario: Read a messages from the API
    Given the API contains a message for this version of the kit saying "Hello, and welcome"
    And I fully restart my prototype
    When I visit the manage prototype homepage
    Then I should only see the message "Hello, and welcome"

  Scenario: Read a different messages from the API
    Given the API contains a message for this version of the kit saying "This is a message from the API, it's used for communicating known issues with older versions."
    And I fully restart my prototype
    When I visit the manage prototype homepage
    Then I should only see the message "This is a message from the API, it's used for communicating known issues with older versions."

  Scenario: No API messages by default
    When I visit the manage prototype homepage
    Then I should not see any messages
