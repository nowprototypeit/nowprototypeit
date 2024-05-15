function wrapInRawTags (fileContents) {
  return `{% raw %}${fileContents}{% endraw %}`
}

module.exports = {
  wrapInRawTags
}
