Feature: Hosting

@no-variant
@hosting-experiment-on
Scenario: Hosting
  When I visit "/manage-prototype/hosting"
  Then the page should include a paragraph that reads "To start hosting you'll need to log in to your nowprototype.it account."
