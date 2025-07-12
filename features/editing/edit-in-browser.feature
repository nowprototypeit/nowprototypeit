
@no-variant
@nunjucks
  Feature: Edit nunjucks in-browser
    @edit-in-browser-experiment-on
    Scenario: Edit a nunjucks file (when enabled before starting)
      Given I create a file "app/views/basic.njk" based on the fixture file "nunjucks/basic-example.njk"
      When I visit "/basic"
      And I open the in-browser editor
      Then I should see the contents of "app/views/basic.njk" in the in-browser editor
      When I replace the contents of the in-browser editor with the fixture file "nunjucks/really-basic-page.njk"
      And I press the save button for the in-browser editor
      Then the file "app/views/basic.njk" should contain the same content as the fixture file "nunjucks/really-basic-page.njk"

    @smoke
    Scenario: Edit a nunjucks file (when newly enabled)
      Given I am on the "Experiments" settings page
      And I turn on the "editInBrowser" setting
      And I create a file "app/views/basic.njk" based on the fixture file "nunjucks/basic-example.njk"
      When I visit "/basic"
      And I open the in-browser editor
      Then I should see the contents of "app/views/basic.njk" in the in-browser editor
      When I replace the contents of the in-browser editor with the fixture file "nunjucks/really-basic-page.njk"
      And I press the save button for the in-browser editor
      Then the file "app/views/basic.njk" should contain the same content as the fixture file "nunjucks/really-basic-page.njk"
