(function () {
  if (!window.NOW_PROTOTYPE_IT) {
    window.NOW_PROTOTYPE_IT = {}
  }
  if (!window.NOW_PROTOTYPE_IT.EDIT_IN_BROWSER) {
    window.NOW_PROTOTYPE_IT.EDIT_IN_BROWSER = {}
  }
  const mainViewFileInput = '__view_file_path__'
  const treatHtmlAsNunjucks = '__treat_html_as_nunjucks__' === 'true'
  if (!mainViewFileInput.startsWith('__')) {
    window.NOW_PROTOTYPE_IT.EDIT_IN_BROWSER.MAIN_VIEW_FILE = mainViewFileInput
    window.NOW_PROTOTYPE_IT.EDIT_IN_BROWSER.TREAT_HTML_AS_NUNJUCKS = treatHtmlAsNunjucks
  }
})()
