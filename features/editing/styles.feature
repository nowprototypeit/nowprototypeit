@styles
Feature: Styles

  @no-variant
  @smoke
  Scenario: Updating styles on page from plugin (when the plugin is well set up)
    Given I have the demo plugin "marsha-p-johnson" installed
    And I create a file "app/views/example.njk" based on the fixture file "nunjucks/mpj-example.njk"
    And I append the file "app/assets/sass/application.scss" with contents "body { background: red !important; }"
    When I visit "/example"
    Then the body background color should become "rgb(255, 0, 0)"

  @no-variant
  Scenario: Using a mixin from a plugin
    Given I have the demo plugin "marsha-p-johnson" installed
    And I create a file "app/views/example.njk" based on the fixture file "nunjucks/mpj-example.njk"
    And I append the file "app/assets/sass/application.scss" with contents "body { @include marsha-p-johnson-background-color-green; }"
    When I visit "/example"
    Then the body background color should become "rgb(0, 255, 0)"

  @no-variant
  @auto-reload
  Scenario: Using SASS variables to control plugin styles
    Given I have the demo plugin "marsha-p-johnson" installed
    And I create a page at "/abc" using the "Full example" template from the "Marsha P Johnson" plugin
    When I visit "/abc"
    And I create a file "app/assets/sass/settings.scss" with contents "$marsha-p-johnson-background-color: red;"
    Then the body background color should become "rgb(255, 0, 0)"

  @no-variant
  @auto-reload
  Scenario: Regenerate styles, then reload page
    Given I create a file "app/views/example.njk" based on the fixture file "nunjucks/basic-example.njk"
    When I visit "/example"
    And I append the file "app/assets/sass/application.scss" with contents "body { background: red !important; }"
    Then the body background color should become "rgb(255, 0, 0)"
