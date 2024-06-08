const globalClickListeners = []
const mainViewFile = window?.NOW_PROTOTYPE_IT?.EDIT_IN_BROWSER?.MAIN_VIEW_FILE

const fancyMode = typeof require !== 'undefined'

if (fancyMode) {
  require.config({ paths: { vs: `/manage-prototype/assets/edit-in-browser/monaco-editor/min/vs` } })
}

function addGlobalClickListener (fn) {
  if (globalClickListeners.length === 0) {
    document.body.addEventListener('click', (e) => {
      globalClickListeners.forEach(fn => { fn(e) })
    })
  }

  globalClickListeners.push(fn)
}

let $editor

function getEditor () {
  if (!$editor) {
    document.body.classList.add('nowprototypeit-in-browser-editor-is-open')
    $editor = document.createElement('div')
    $editor.classList.add('nowprototypeit-in-browser-editor')
    $editor.innerText = 'Editor will go here'
    const $closeButton = document.createElement('a')
    $closeButton.setAttribute('href', '#')
    $closeButton.addEventListener('click', (e) => {
      e.preventDefault()
      $editor.parentNode.removeChild($editor)
      document.body.classList.remove('nowprototypeit-in-browser-editor-is-open')
      localStorage.removeItem('nowprototypeit-last-editor-page-url')
    })
    $closeButton.innerText = '(close)'
    $editor.appendChild($closeButton)
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

let currentEditor
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
  $codeWrapper.addEventListener('keydown', async (e) => {
    if (e.metaKey && e.keyCode === 83) {
      e.preventDefault()
      await save(relativeFilePath, value, $submittedMessage)
    }
  })

  if (fancyMode) {
    require(['vs/editor/editor.main'], function () {
      const $code = document.createElement('div')
      $code.classList.add('nowprototypeit-in-browser-editor__editor')
      $codeWrapper.appendChild($code)
      currentEditor = window.monaco.editor.create($code, {
        value: responseJson.fileContents,
        language: getLanguageFromFileExtension(relativeFilePath.split('.').at(-1)),
        fontSize: "12px",
        automaticLayout: true
      })
    })
  } else {
    const $code = document.createElement('textarea')
    $code.classList.add('nowprototypeit-in-browser-editor__editor')
    $code.value = responseJson.fileContents
    $codeWrapper.appendChild($code)
    currentEditor = {
      getValue: () => $code.value
    }
  }

  const $submitButton = document.createElement('button')
  $submitButton.innerText = 'Save changes'
  $submitButton.addEventListener('click', async (e) => {
    e.preventDefault()
    const value = currentEditor.getValue()
    const $submittedMessage = document.createElement('p')
    $submittedMessage.innerText = 'Submitted, waiting to refresh.'
    $editor.insertBefore($submittedMessage, $codeWrapper)
    $editor.removeChild($codeWrapper)
    await save(relativeFilePath, value, $submittedMessage)
  })
  $editor.appendChild($submitButton)
}

async function showEditor () {
  localStorage.setItem('nowprototypeit-last-editor-page-url', window.location.href)
  const $editor = getEditor()
  await populateEditor($editor, mainViewFile)
  document.body.appendChild($editor)
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
  'nowprototypeit-in-browser-bar__add-edit-button-li': ($elem, options) => {
    if (!mainViewFile) {
      return
    }
    loadOrClearPreviousState()
    const $li = document.createElement('li')
    const $a = document.createElement('a')
    $li.appendChild($a)
    $a.innerText = 'Edit this page'
    $a.setAttribute('href', '#')
    $a.addEventListener('click', async (e) => {
      e.preventDefault()
      await showEditor()
    })
    $elem.appendChild($li)
  },
  'nowprototypeit-in-browser-bar__turn-into-burger-menu': ($elem, options) => {
    const $parentNode = $elem.parentNode
    const $burger = document.createElement('div')
    $burger.classList.add('nowprototypeit-in-browser-bar__burger-menu')
    $burger.innerText = 'Burger'
    $burger.addEventListener('click', (e) => {
      e.preventDefault()
      $elem.classList.toggle('nowprototypeit-in-browser-bar__burger-menu-contents--closed')
    })
    $elem.classList.add('nowprototypeit-in-browser-bar__burger-menu-contents')
    $elem.classList.add('nowprototypeit-in-browser-bar__burger-menu-contents--closed')
    $parentNode.appendChild($burger)

    function elemIsChildOfBurgerMenu ($clickedElem) {
      for (let $currentNode = $clickedElem; $currentNode !== null; $currentNode = $currentNode.parentNode) {
        if ($currentNode === $elem || $currentNode === $burger) {
          return true
        }
      }
      return false
    }

    addGlobalClickListener(e => {
      if (!$elem.classList.contains('nowprototypeit-in-browser-bar__burger-menu-contents--closed') && !elemIsChildOfBurgerMenu(e.target)) {
        $elem.classList.add('nowprototypeit-in-browser-bar__burger-menu-contents--closed')
      }
    })
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
