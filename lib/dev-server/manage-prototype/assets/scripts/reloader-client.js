(() => {
  let lastReload
  try {
    // eslint-disable-next-line
    lastReload = __DATE__
  } catch (e) {
    lastReload = Date.now()
  }

  const scrollTo = window.localStorage.getItem('nowprotoypeit-scroll-after-reload')
  if (scrollTo) {
    document.addEventListener('DOMContentLoaded', () => {
      window.scrollTo(0, parseInt(scrollTo, 10))
    })
  }
  window.localStorage.removeItem('nowprotoypeit-scroll-after-reload')
  let repeatFailureCount = 0

  function checkForReload () {
    fetch(`/manage-prototype/reload-trigger?lastReload=${encodeURIComponent(lastReload)}&url=${encodeURIComponent(window.location.href)}`)
      .then((response) => {
        response.json().then(json => {
          if (json.shouldReload) {
            window.localStorage.setItem('nowprotoypeit-scroll-after-reload', window.scrollY)
            window.location.reload()
          } else {
            setTimeout(checkForReload, json.nextCheckInMilliseconds || 1000)
          }
        })
      })
      .catch(() => {
        repeatFailureCount++
        setTimeout(checkForReload, getDelayForFailureCount(repeatFailureCount))
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
