document.body.parentNode.classList.add('js-enabled')

window.nowPrototypeItGOVUK = {
  majorVersion: 0,
  documentReady: (fn) => {
    if (document.readyState !== 'loading') {
      // IE9 support
      fn()
    } else {
      // Everything else
      document.addEventListener('DOMContentLoaded', fn)
    }
  },
  internal: {}
}

window.GOVUKPrototypeKit = {
  majorVersion: 13,
  documentReady: window.nowPrototypeItGOVUK.documentReady
}

// Warn about using the kit in production
if (window.console && window.console.info) {
  window.console.info('Now Prototype It - do not use for production')
}
