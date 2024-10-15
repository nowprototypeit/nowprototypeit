@integration
Feature: Handle kit install

  @kit-update
  Scenario: Downgrading to a previous version
    When I install the "0.9.2" version of the kit from NPM
    Then I should be using version "0.9.2" of the kit from NPM

  @kit-update-from-0.9.4
  Scenario: Upgrading to the version being tested
    When I install the version of the kit being tested
    Then I should be using version of the kit being tested
