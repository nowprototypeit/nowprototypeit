const frontMatter = require('front-matter')
const marked = require('marked')
const { wrapInRawTags } = require('../nunjucks/utils')
let allowMarkdownRendererAdd = false
const defaultMarkdownRendererName = 'nowprototypeit:default'
const markdownRenderersByName = {}

markdownRenderersByName[defaultMarkdownRendererName] = marked.parse.bind(marked)

function addMarkdownRenderer (name, renderFunction) {
  if (!allowMarkdownRendererAdd) {
    console.error(`Not allowing markdown renderer [${name}] to be added at this time`)
  }
  markdownRenderersByName[name] = renderFunction
}

function parseMarkdown (markdown, metadata) {
  const rendererName = metadata?.attributes?.useRenderer
  const renderFn = markdownRenderersByName[rendererName]
  if (!renderFn && rendererName) {
    console.error(`No markdown renderer found for [${rendererName}], falling back to [${defaultMarkdownRendererName}], options are: [${Object.keys(markdownRenderersByName).join(', ')}]`)
  }
  return (renderFn || markdownRenderersByName[defaultMarkdownRendererName])(markdown, metadata)
}

function stripAndUnstripNjk (str) {
  const strippedParts = {}
  let strippedContents = str

  const splitOn = [{ start: '{{', end: '}}' }, { start: '{%', end: '%}' }]

  splitOn.forEach(({ start, end }) => {
    while (strippedContents.includes(start)) {
      const startIndex = strippedContents.indexOf(start)
      const endIndex = strippedContents.indexOf(end)
      if (end === -1) {
        return
      }
      const key = `%%%%%%%${Object.keys(strippedParts).length}%%%%%%%`
      strippedParts[key] = strippedContents.substring(startIndex, endIndex + end.length)
      strippedContents = strippedContents.replace(strippedParts[key], `${key}`)
    }
  })

  return {
    strippedContents,
    unstrip: (rendered) => Object.keys(strippedParts).reduce((acc, key) => acc
      .replace(`<p>${key}</p>`, strippedParts[key])
      .replace(new RegExp(`<p[^>]*>${key}</p>`), strippedParts[key])
      .replace(key, strippedParts[key])
    , rendered)
  }
}

function renderMarkdownAsNunjucks (fileContents) {
  const fmData = frontMatter(fileContents)

  const nunjucksParts = []
  const attrs = fmData.attributes || {}
  const njkVars = attrs.nunjucksVariables || {}
  const strip = attrs.processOutputAs === 'njk' ? stripAndUnstripNjk : x => ({ strippedContents: x, unstrip: (body) => wrapInRawTags(body) })
  const strippedResult = strip(fmData.body)
  const renderedBody = parseMarkdown(strippedResult.strippedContents, fmData)
  Object.keys(njkVars).forEach(key => {
    nunjucksParts.push(`{% set ${key} %}${njkVars[key]}{% endset %}`)
  })
  if (attrs.nunjucksLayout) {
    nunjucksParts.push(`{% extends "${attrs.nunjucksLayout}" %}`)
  }
  if (attrs.nunjucksMainBlock) {
    nunjucksParts.push(`{% block ${attrs.nunjucksMainBlock} %}`)
    nunjucksParts.push(strippedResult.unstrip(renderedBody))
    nunjucksParts.push('{% endblock %}')
  } else {
    nunjucksParts.push(strippedResult.unstrip(renderedBody))
  }

  return nunjucksParts.join('')
}

module.exports = {
  addMarkdownRendererFromPlugin: (packageName, rendererName, renderFunction) => {
    const fullName = [packageName, rendererName].join(':')
    if (typeof renderFunction !== 'function') {
      console.error(`renderFunction for [${fullName}] must be a function`)
      return
    }
    const orig = allowMarkdownRendererAdd
    allowMarkdownRendererAdd = true
    addMarkdownRenderer(fullName, renderFunction)
    allowMarkdownRendererAdd = orig
  },
  renderMarkdownAsNunjucks
}
