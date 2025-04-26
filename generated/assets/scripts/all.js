if (window.Promise) {
  (function () {
    const htmlClassList = document.body.parentNode.classList
    htmlClassList.remove('nowprototypeit-no-js')
    htmlClassList.add('nowprototypeit-js-enabled')
    const snakeCaseFromKebabCase = (input) => {
      const parts = input.toLowerCase().split('-')
      return parts.map((x, index) => index > 0 ? x[0].toUpperCase() + x.substring(1) : x).join('')
    }

    function setupDomWidgets (domWidgets) {
      document.addEventListener('DOMContentLoaded', () => {
        [...document.querySelectorAll('[data-dom-widget]')].forEach(($elem) => {
          const config = {}
          ;[...$elem.attributes].forEach(attr => {
            const prefix = 'data-'
            if (attr.name.startsWith(prefix)) {
              config[snakeCaseFromKebabCase(attr.name.substring(prefix.length))] = attr.value
            }
          })
          ;(domWidgets[config.domWidget] || function () {
          })($elem, config)
        })
      })
    }

    window.nowPrototypeItDesignSystem = window.nowPrototypeItDesignSystem || {}
    window.nowPrototypeItDesignSystem.setupDomWidgets = setupDomWidgets

    setupDomWidgets({
      'scroll-to-this-element': ($elem, config) => {
        $elem.scrollIntoView({ behavior: 'smooth' })
      },
      'add-class-on-value-change': ($elem, config) => {
        const originalValue = $elem.value
        $elem.addEventListener('blur', () => {
          console.log('blur', $elem.value, originalValue, $elem.value !== originalValue)
          if ($elem.value !== originalValue) {
            $elem.classList.add(config.changedValueClass)
          } else {
            $elem.classList.remove(config.changedValueClass)
          }
        })
      },
      'conditional-reveal': ($elem, config) => {
        console.log('conditional-reveal', config.fieldId, config.revealId)
        const $button = $elem.querySelector('#' + config.fieldId)
        const $reveal = $elem.querySelector('#' + config.revealId)
        const buttonNameAttr = $button.getAttribute('name')

        const $allButtons = [...document.querySelectorAll(`[name="${buttonNameAttr}"]`)]
        $allButtons.forEach($button => {
          $button.addEventListener('change', update)
        })

        function update () {
          console.log('updating', $button.checked, $reveal, $button)
          if ($button.checked) {
            $reveal.classList.remove('js-hidden')
            $reveal.scrollIntoView({ behavior: 'smooth' })
          } else {
            $reveal.classList.add('js-hidden')
          }
        }

        $button.addEventListener('change', update)
        window.addEventListener('pageshow', update)
      }
    })
  })()
}
