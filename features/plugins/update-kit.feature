@integration
Feature: Handle kit install

  @kit-update
  Scenario: Downgrading to a previous version
    Given I create a file "app/views/index.html" with contents "<h1>Hello world</h1>"
    When I install the "0.9.2" version of the kit from NPM
    And I visit the homepage
    Then the main heading should be updated to "Hello world"
    And I should be using version "0.9.2" of the kit from NPM

#  ---
#  This can be run experimentally after version 0.9.4 is released.  If those tests go smoothly then they should be
#  usable when the package version during the test is above 0.9.4.
#  ---
#  @kit-update-from-0.9.4
#  Scenario: Upgrading to the version being tested
#    When I install the version of the kit being tested
#    Then I should be using version of the kit being tested
