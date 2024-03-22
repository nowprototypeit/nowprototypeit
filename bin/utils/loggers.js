const argv = require('./argv-parser').parse(process.argv)

const verboseLogger = !argv.options.verbose
  ? () => {}
  : function () {
    console.log('[verbose]', ...arguments)
  }
const progressLogger = function (firstPart, ...otherParts) {
  console.log(' - ' + firstPart, ...otherParts)
}

module.exports = {
  verboseLogger,
  progressLogger
}
