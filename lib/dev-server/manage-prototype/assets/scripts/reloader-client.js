(() => {
  let lastReload
  try {
    // eslint-disable-next-line
    lastReload = __DATE__
  } catch (e) {
    lastReload = Date.now()
  }

  const scrollKey = 'nowprotoypeit-scroll-after-reload'
  const fieldsKey = 'nowprotoypeit-fields-after-reload'
  const scrollTo = window.localStorage.getItem(scrollKey)
  if (scrollTo) {
    document.addEventListener('DOMContentLoaded', () => {
      window.scrollTo(0, parseInt(scrollTo, 10))
    })
  }
  const fields = window.localStorage.getItem(fieldsKey)
  if (fields) {
    try {
      const parsedFields = JSON.parse(fields)
      const simple = parsedFields?.simple || {}
      Object.keys(simple).forEach((key) => {
        const fields = document.querySelectorAll(`[name="${key}"]`)
        fields.forEach((field) => {
          if (field && field.type !== 'checkbox' && field.type !== 'radio') {
            field.value = simple[key]?.shift() || ''
          }
        })
      })
      const checked = parsedFields?.checked || {}
      Object.keys(checked).forEach((key) => {
        const arr = checked[key]
        while (arr.length > 0) {
          const value = arr.shift()
          const fields = document.querySelectorAll(`[name="${key}"][value="${value}"]`)
          fields.forEach((field) => {
            if (field.type === 'checkbox' || field.type === 'radio') {
              field.checked = true
            }
          })
        }
      })
    } catch (e) {
      console.error('Failed to parse fields from localStorage:', e)
    }
  }
  window.localStorage.removeItem(scrollKey)
  window.localStorage.removeItem(fieldsKey)
  let repeatFailureCount = 0

  function checkForReload () {
    fetch(`/manage-prototype/reload-trigger?lastReload=${encodeURIComponent(lastReload)}&url=${encodeURIComponent(window.location.href)}`)
      .then((response) => {
        response.json().then(json => {
          if (json.shouldReload) {
            window.localStorage.setItem(scrollKey, window.scrollY)
            const fieldsStorageValue = JSON.stringify(
              Array.from(document.querySelectorAll('input, select, textarea'))
                .reduce((acc, field) => {
                  if (field.name) {
                    if (field.type === 'checkbox' || field.type === 'radio') {
                      const current = acc.checked[field.name] = acc.checked[field.name] || []
                      if (field.checked) {
                        current.push(field.value)
                      }
                    } else {
                      const current = acc.simple[field.name] = acc.simple[field.name] || []
                      current.push(field.value)
                    }
                  }
                  return acc
                }, { simple: {}, checked: {} })
            )
            window.localStorage.setItem(fieldsKey, fieldsStorageValue)
            window.location.reload()
          } else {
            setTimeout(checkForReload, json.nextCheckInMilliseconds || 1000)
          }
        })
      })
      .catch(() => {
        repeatFailureCount++
        const delay = getDelayForFailureCount(repeatFailureCount)
        setTimeout(checkForReload, delay)
      })
  }

  checkForReload()

  function getDelayForFailureCount (failureCount) {
    if (failureCount > 10) {
      return 10000
    }
    return 200
  }
})()
