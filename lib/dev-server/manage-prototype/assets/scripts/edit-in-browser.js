const mainViewFile = window?.NOW_PROTOTYPE_IT?.EDIT_IN_BROWSER?.MAIN_VIEW_FILE
const treatHtmlAsNunjucks = !!window?.NOW_PROTOTYPE_IT?.EDIT_IN_BROWSER?.TREAT_HTML_AS_NUNJUCKS

const fancyMode = typeof require !== 'undefined'

if (fancyMode) {
  require.config({ paths: { vs: '/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs' } })
}

let $editor
let focusEditor = () => {}

async function getEditor () {
  if (!$editor) {
    document.body.classList.add('nowprototypeit-in-browser-editor-is-open')
    $editor = document.createElement('div')
    $editor.classList.add('nowprototypeit-injected-elements')

    $editor.classList.add('nowprototypeit-in-browser-editor')
    const $closeButton = document.createElement('a')
    $closeButton.setAttribute('href', '#')
    $closeButton.addEventListener('click', (e) => {
      e.preventDefault()
      $editor.parentNode.removeChild($editor)
      document.body.classList.remove('nowprototypeit-in-browser-editor-is-open')
      localStorage.removeItem('nowprototypeit-last-editor-page-url')
      focusEditor = () => {}
    })
    const $closeButtonScreenReaderText = document.createElement('span')
    $closeButtonScreenReaderText.innerText = 'Close editor'
    $closeButton.appendChild($closeButtonScreenReaderText)
    $closeButton.classList.add('nowprototypeit-in-browser-editor__close-button')
    $editor.appendChild($closeButton)
    await populateEditor($editor, mainViewFile)
  }
  return $editor
}

function relativeFilePathToFileUrl (relativeFilePath) {
  return `/manage-prototype/edit-in-browser/file-contents?relativeFilePath=${encodeURIComponent(relativeFilePath)}`
}

async function save (relativeFilePath, value, $submittedMessage) {
  const result = await fetch(relativeFilePathToFileUrl(relativeFilePath), {
    method: 'PUT',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileContents: value
    })
  })
  const resultJson = await result.json()
  if (resultJson.success) {
    $submittedMessage.innerText = 'Successfully saved, waiting to refresh.'
  } else {
    $submittedMessage.innerText = 'Something seems to have gone wrong :('
  }
}

const languageByFileName = {
  md: {
    language: 'markdown'
  },
  njk: {
    language: 'twig'
  },
  json: {
    language: 'json'
  },
  scss: {
    language: 'scss'
  },
  js: {
    language: 'javascript'
  },
  html: {
    language: treatHtmlAsNunjucks ? 'twig' : 'html'
  }
}
const getLanguageFromFileExtension = fileExtension => languageByFileName[fileExtension]?.language

async function populateEditor ($editor, relativeFilePath) {
  const contents = await fetch(relativeFilePathToFileUrl(relativeFilePath))
  const responseJson = await contents.json()
  console.log('response json', responseJson)
  let currentEditor
  const $codeWrapper = document.createElement('div')

  $editor.appendChild($codeWrapper)

  if (fancyMode) {
    require(['vs/editor/editor.main'], function () {
      const $code = document.createElement('div')
      $code.classList.add('nowprototypeit-in-browser-editor__editor')
      $codeWrapper.appendChild($code)
      const monacoEditor = window.monaco.editor.create($code, {
        value: responseJson.fileContents,
        language: getLanguageFromFileExtension(relativeFilePath.split('.').at(-1)),
        fontSize: '12px',

        automaticLayout: true
      })
      window.NOW_PROTOTYPE_IT.__for_automation_only_currentEditor = currentEditor = monacoEditor
      focusEditor = () => {
        monacoEditor.focus()
      }
    })
  } else {
    const $code = document.createElement('textarea')
    $code.classList.add('nowprototypeit-in-browser-editor__editor')
    $code.value = responseJson.fileContents
    $codeWrapper.appendChild($code)
    focusEditor = () => {
      $code.focus()
    }
    currentEditor = {
      getValue: () => $code.value
    }
  }

  const $submitButton = document.createElement('button')
  $submitButton.setAttribute('id', 'nowprototypeit-in-browser-editor__submit-button')
  $submitButton.innerText = 'Save changes'

  async function runSaveAction () {
    const value = currentEditor.getValue()
    const $submittedMessage = document.createElement('p')
    $submittedMessage.innerText = 'Submitted, waiting to refresh.'
    $editor.insertBefore($submittedMessage, $codeWrapper)
    $editor.removeChild($codeWrapper)
    await save(relativeFilePath, value, $submittedMessage)
  }

  $submitButton.addEventListener('click', async (e) => {
    e.preventDefault()
    await runSaveAction()
  })

  document.addEventListener('keydown', async (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      await runSaveAction()
    }
  })
  $editor.appendChild($submitButton)
}

async function showEditor () {
  if (!document.querySelector('.nowprototypeit-in-browser-editor')) {
    localStorage.setItem('nowprototypeit-last-editor-page-url', window.location.href)
    const $editor = await getEditor()
    document.body.appendChild($editor)
  }
  focusEditor()
}

function loadOrClearPreviousState () {
  const previousHref = localStorage.getItem('nowprototypeit-last-editor-page-url')
  if (previousHref === window.location.href) {
    showEditor()
  } else {
    localStorage.removeItem('nowprototypeit-last-editor-page-url')
  }
}

const domWidgets = {
  'nowprototypeit-in-browser-bar__add-edit-button': ($elem, options) => {
    if (!mainViewFile) {
      return
    }
    loadOrClearPreviousState()
    const $a = document.createElement('a')
    $a.innerText = 'Edit this page'
    $a.setAttribute('href', '#')
    $a.setAttribute('id', 'nowprototypeit-in-browser-bar_edit-button')
    $a.addEventListener('click', async (e) => {
      e.preventDefault()
      await showEditor()
    })
    const $li = document.createElement('li')
    $li.appendChild($a)
    $elem.appendChild($li)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Object.keys(domWidgets).forEach((selector) => {
    [...document.querySelectorAll(`[data-dom-widget~="${selector}"`)].forEach(($elem) => {
      domWidgets[selector]($elem, [...$elem.attributes].filter(x => x.name.startsWith('data-')).reduce((acc, x) => {
        acc[x.name.replace('data-', '').split('-').map((x, k) => x.length > 0 && k > 0 ? x[0].toUpperCase() + x.slice(1) : x).join('')] = x.value
        return acc
      }, {}))
    })
  })
})
