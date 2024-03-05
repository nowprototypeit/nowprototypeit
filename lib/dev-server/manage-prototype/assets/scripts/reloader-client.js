(() => {
  // eslint-disable-next-line
  const lastReload = (window.nowPrototypeItGOVUK && window.nowPrototypeItGOVUK.lastReload) || __DATE__
  const urlPath = window.location.pathname

  const scrollTo = window.localStorage.getItem('nowprotoypeit-scroll-after-reload')
  if (scrollTo) {
    document.addEventListener('DOMContentLoaded', () => {
      window.scrollTo(0, parseInt(scrollTo, 10))
    })
  }
  window.localStorage.removeItem('nowprotoypeit-scroll-after-reload')

  function checkForReload () {
    fetch(`/manage-prototype/reload-trigger?lastReload=${encodeURIComponent(lastReload)}&url=${encodeURIComponent(window.location.href)}`)
      .then((response) => {
        response.json().then(json => {
          if (json.shouldReload) {
            window.localStorage.setItem('nowprotoypeit-scroll-after-reload', window.scrollY)
            window.location.href = urlPath
          } else {
            setTimeout(checkForReload, json.nextCheckInMilliseconds || 1000)
          }
        })
      })
      .catch(() => {
        setTimeout(checkForReload, 10000)
      })
  }

  checkForReload()
})()
