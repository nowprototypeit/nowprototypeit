# Changelog

## Unreleased

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
