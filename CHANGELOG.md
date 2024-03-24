## Changelog

## Unreleased

## New Features

 - The project is now called "nowprototypeit" rather than "@nowprototypeit/govuk" as all references to GOV.UK have been removed, the same behaviour can be achieved by using the `@nowprototypeit/govuk-frontend-adaptor` variant
 - Variant inheritance is now (theoretically) infinitely deep, any variant you inherit from is installed and then used as the base for your variant  

## Fixes

 - The work done on variants now works on Windows
 - Now that we have a new Github repository that's not a fork we can run the CI tests, they've highlighted a few issues which have been resolved, and they'll continue to run to make sure similar issues don't creep in
 - Removed unused dependencies and redefined test dependencies as such

## 0.2.0

### New Features

 - Created a "variant" system alongside the plugin system, this allows authors to define how a new kit should be created
 - Removed the remaining govuk-frontend specific code and added a new plugin to allow for the use of the `govuk-frontend` library (@nowprototypeit/govuk-frontend-adaptor)
 - Improved watching when the user installs, updates or uninstalls a plugin using the command line while the kit is running
 - Allowed plugins to specify related plugins which will show the plugin discovery page
 - Allowed plugins to specify "proxy config" for modules which can't manage their own plugin configuration
 - Allowed plugins to specify "settings" which can be used as variables in SASS and Nunjucks 
 - Always using `.njk` file extensions for nunjucks templates
 - Always allowing GOV.UK Frontend to be uninstalled
 - Always showing the plugin lookup
 - Service Name is removed from the settings page as it's GOV.UK Frontend specific, in future this will be able to be added back in using plugin configuration
 - Moved the file watchers onto their own thread to prevent blocking the main thread (this should make the kit feel more responsive)

## 0.1.0

### New Features

 - Seperated the user's kit from the management pages
 - Added settings page in Manage Prototype
 - All HTML pages now auto-refresh regardless of the template used (this includes basic output from routes)
 - Added cucumberjs browser tests
 - Plugin install/update/uninstall now happens faster and more reliably
 - Allowing plugins to specify settings which turn into nunjucks/sass variables
 - Added a messaging feature to manage prototype for things like update alerts and warnings if a security vulnerability is found
 - Added plugin details page
 - Added a plugin lookup for finding plugins which aren't listed
 - Added new Now Prototype It branding
 - Pre-building assets for a quicker prototype startup

### Fixes

 - The page refresh issue which caused continual reloading is now resolved
 - In separating the user's kit from the management pages lots of changes were needed, a lot of things like error handling have needed an overhaul as part of that work

## 0.0.2

### New Features

 - Replaced GDS Transport Font (due to licencing restrictions and branding)
 - Added installed plugins to the Find Plugins page
 - Added more plugins to the plugin list
 - Explained that plugins aren't subject to an approval process
 - Better separation of management pages and user's pages (using nunjucks paths)

### Fixes

- Removed the code that makes pages continually reload while investigating a proper fix

## 0.0.1

### New Features

 - Striped out GOV.UK References
 - Put in Now Prototype It branding (unstyled)
 - New Plugin Details page

To see historic changes before we forked the GOV.UK Prototype Kit check out their changelog from that time: https://github.com/alphagov/govuk-prototype-kit/blob/2fedd466c8628519be54aca3ac86695dfd241ae1/CHANGELOG.md
