# Changelog

## Unreleased

## 0.11.2

### Improvements

 - Service name is no longer included in the core config as it's only for some plugins, it is included in the plugin configuration for those plugins that need it
 - If the session-data-defaults.js file is malformed an error is shown to the user rather than the default silently being used

## 0.11.1

### Improvements

 - Improved the plugin validator, partially caught up with the new features in the plugin system
 - Included the licence in the package.json so it can be seen more clearly in the npm registry (we were already using the MIT licence, just not displaying it in NPM)

## 0.11.0

### New Features

- Hosting improvements including update messages while your prototype is being uploaded

### Fixes

- Removed unused dependencies, reducing the size of the kit and the number of opportunities for vulnerabilities - this also makes the kit quicker to install and run
- Updated to the latest version of various dependencies to reduce vulnerabilities

## 0.10.0

### New Features

- Added the hosting tab to Manage Prototype

### Improvements

- More improvements to the hosting pages.

## 0.9.5

### Improvements

- Improvements to the authentication and hosting pages.

## 0.9.4

### Fixes

- Removed unused and underused dependencies to reduce the size of the kit and the number of opportunities for
vulnerabilities.  This also makes the kit quicker to install and run.  Fixed npm audit issues.

## 0.9.3

### Fixes

- Fixing in-browser update on Windows, adding a version endpoint to allow future tests to know which kit version is 
  running.

## 0.9.2

### Fixes

- Correcting the messages URL in the management pages.

## 0.9.1

### Fixes

- Correcting updates when commands (e.g. install/update/remove plugins) fail.

## 0.9.0

### New Features

- Added a link to 404 pages to allow users to quickly create the page that should have been found.
- Added a persistence layer to allow an object to be stored between restarts - this is both for local development and the hosting platform we're working on.
- Preparation work for allowing the kit to update itself, this is particularly hard to test without making releases so no call-to-action has been added yet.

## 0.8.1

### Fixes

- Made improvements to the hosting integration.

## 0.8.0

### New Features

- Added the ability for plugins to provide routers allowing them to provide partial user journeys.

### Fixes

- No longer allowing in-browser editing of files from node_modules
- Syntax highlighting html files as HTML when using the "respect file extensions" experiment
- Syntax highlighting html files as Nunjucks when not using the "respect file extensions" experiment

### Experimental Features

- Added an early exploration into an integrated hosting solution.  This is too early to appear in the settings pages but including it here allows us to work on the hosting platform and get ready for it to become an experiment that users can opt in to.

## 0.7.0

### Experimental Features

- Added an in-browser editor, it's at a very early stage.  It currently only supports the view file when using standard file naming.  We would love your feedback on this feature, please raise Github Issues with any feedback

### New Features

- Introduced password protection for prototypes hosted outside our dedicated hosting platform
- Added an explanation when a user doesn't set up a password or intentionally opt-out of password protection

## 0.6.1

### Fixes

- Fixed an issue causing repeated reloads.

## 0.6.0

### Experimental Features

- Respecting file extensions - using `.njk` for Nunjucks templates and treating `.html` files as just HTML (when using the respect file extensions experiment)
- Allowing markdown views and includes (when using the respect file extensions experiment)
- Allowing plugins to provide Markdown Renderers (when using the respect file extensions experiment)
- Experimentally allowing plugins to provide Markdown Templates for the user to use when creating new pages, this integration may change based on feedback - please provide feedback if you're using this feature support@nowprototype.it (when using the respect file extensions experiment)

### New Features

- Plugin lookup is no longer experimental, it's now a core feature

## 0.5.0

### New Features

- Replaced `basePlugins`, it was created a long time ago to allow a plugin like `govuk-frontend` to be built upon by a plugin like `hmrc-frontend` but now we have `pluginDependencies` which puts the decision into the hands of the plugin developer rather than the person building the prototype.  In the above example `hmrc-frontend` already depends on `govuk-frontend` so the order can be calculated without `basePlugins` being set. 

## 0.4.1

### Fixes

- Removed ZLib dependency, using built in node implementation - this solves an installation issue
- POST requests are now being proxied correctly - this allows `<form method="post">` and calls to `.post()` routes which weren't previously working in development mode unless the request body was empty
- Silenced npm logs to clean up the output when you run commands
- Renamed 'failed-to-launch' to 'validate-kit' as it's less scary wording for the same feature (this runs if a command like npm run dev fails and will, in future, be used to offer solutions like running `npm install` if packages are missing)

## 0.4.0

## New Features

- The project is now called "nowprototypeit" rather than "@nowprototypeit/govuk" as all references to GOV.UK have been removed, the same behaviour can be achieved by using the `@nowprototypeit/govuk-frontend-adaptor` variant
- Variant inheritance is now (theoretically) infinitely deep, any variant you inherit from is installed and then used as the base for your variant

## 0.3.0

### Fixes

 - The work done on variants now works on Windows
 - Now that we have a new Github repository that's not a fork we can run the CI tests, they've highlighted a few issues which have been resolved, and they'll continue to run to make sure similar issues don't creep in
 - Removed unused dependencies and redefined test dependencies as such

### New Features
 - Allowing plugins to provide settings which can be updated by the user in the Management Pages
 - Allowing hierarchical nunjucks variables from plugin settings
 - Allowing more styling classes for homepage content

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
