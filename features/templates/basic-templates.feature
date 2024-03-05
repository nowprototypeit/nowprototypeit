@templates
Feature: Templates
  
  @integration
  Scenario: Create a GOV.UK Page
    Given I have the "GOV.UK Frontend" ("npm:govuk-frontend") plugin installed
    And I have the "Common Templates" ("npm:@govuk-prototype-kit/common-templates") plugin installed
    When I create a page at "/hello/world/this/is/a/test" using the "Question page" template from the "Common Templates From GOV.UK Prototype Kit" plugin
    Then I should see a template creation success page
    When I click through to the page I created from a template
    Then I should see the GOV.UK Header
    And I should see the page header "Heading or question goes here"
    And I should see the crown icon in the footer

  @integration
  Scenario: Preview
    Given I have the "GOV.UK Frontend" ("npm:govuk-frontend") plugin installed
    And I have the "Common Templates" ("npm:@govuk-prototype-kit/common-templates") plugin installed
    When I preview the "Question page" template from the "Common Templates From GOV.UK Prototype Kit" plugin
    Then I should see the GOV.UK Header
    And I should see the page header "Heading or question goes here"
    And I should see the crown icon in the footer
    
  Scenario: Demo Plugin 
    Given I have the demo plugin "marsha-p-johnson" installed
    When I create a page at "/abc/def/ghi/jkl" using the "The first pride was a riot" template from the "Marsha P Johnson" plugin
    Then I should see a template creation success page
    When I click through to the page I created from a template
    Then the page title should read "The first pride was a riot"
    Then the main heading should read "Fun fact, this is technically a valid HTML5 document"
    
