const eventTypes = require('../../../dev-server-event-types')
const events = require('../../../dev-server-events')
const plugins = require('../../../../plugins/plugins')
const path = require('path')
const { projectDir } = require('../../../../utils/paths')
const { getUniqueId } = require('../../../dev-server-events')

const callbacks = {}

events.on(eventTypes.TEMPLATE_PREVIEW_RESPONSE, (info) => {
  const id = info.id

  if (callbacks[id]) {
    callbacks[id](info)
  }
})

const locateTemplateConfig = (queryParams) => {
  const debugOutput = []
  const byType = plugins.getByType('templates')
  const packageTemplates = byType.filter(({ packageName }) => packageName === queryParams.package)
  debugOutput.push(`packages ${JSON.stringify(packageTemplates.map(({ packageName }) => packageName), null, 2)}`)
  if (packageTemplates.length > 0) {
    const pathToMatch = queryParams.template
    debugOutput.push(`path to match ${pathToMatch}`)
    const template = packageTemplates.find(({ item }) => {
      // switch backslashes for forward slashes in case of windows
      const path = item.path.split('\\').join('/')
      debugOutput.push(`path ${path}`)
      return path === pathToMatch
    })
    if (template) {
      debugOutput.push('found')
      return {
        path: path.join(projectDir, 'node_modules', template.packageName, template.item.path),
        name: template.item.name
      }
    } else {
      debugOutput.push('not found')
    }
  }
}

async function requestTemplatePreviewFromKit (options) {
  return await new Promise((resolve, reject) => {
    const templateInfo = locateTemplateConfig(options)
    if (!templateInfo) {
      reject(new Error('No template config found for options: ' + JSON.stringify(options)))
      return
    }
    const id = getUniqueId()
    const timeout = setTimeout(() => {
      delete callbacks[id]
      reject(new Error('Template preview request took too long.'))
    }, 10000)
    callbacks[id] = (info) => {
      clearTimeout(timeout)
      if (info.error) {
        reject(info.error)
      } else {
        resolve(info.result)
      }
    }
    events.emitExternal(eventTypes.TEMPLATE_PREVIEW_REQUEST, { templatePath: templateInfo.path, id })
  })
}

module.exports = {
  requestTemplatePreviewFromKit,
  locateTemplateConfig
}
