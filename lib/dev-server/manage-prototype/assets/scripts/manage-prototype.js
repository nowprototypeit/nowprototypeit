if (window.Promise) {
  function incrementProgressBarByNumber ($progressBar, increment) {
    $progressBar.setAttribute('value', '' + (parseInt($progressBar.getAttribute('value'), 10) + increment))
  }

  (function () {
    const htmlClassList = document.body.parentNode.classList
    htmlClassList.remove('no-js')
    htmlClassList.add('js-enabled')

    const domWidgets = {
      'scroll-to-this-element': ($elem, config) => {
        $elem.scrollIntoView({ behavior: 'smooth' })
      },
      'conditional-reveal': ($elem, config) => {
        const $button = $elem.querySelector('#' + config.fieldId)
        const $reveal = $elem.querySelector('#' + config.revealId)
        const buttonNameAttr = $button.getAttribute('name')

        const $allButtons = [...document.querySelectorAll(`[name="${buttonNameAttr}"]`)]
        $allButtons.forEach($button => {
          $button.addEventListener('change', update)
        })
        function update () {
          if ($button.checked) {
            $reveal.classList.remove('js-hidden')
            $reveal.scrollIntoView({ behavior: 'smooth' })
          } else {
            $reveal.classList.add('js-hidden')
          }
        }
        $button.addEventListener('change', update)
        update()
      },
      'show-full-error': ($elem, config) => {
        const $revealArea = $elem.querySelector('.reveal-area')
        const $button = $elem.querySelector(`#${config.buttonId || 'show-full-error'}`)
        if (!$revealArea || !$button) {
          return
        }
        $revealArea.remove()
        $button.addEventListener('click', (e) => {
          e.preventDefault()
          $button.remove()
          $elem.appendChild($revealArea)
        })
      },
      'plugin-command-runner': ($elem, config) => {
        const elementsAdded = false
        const $progressBar = document.createElement('progress')
        const $progressList = document.createElement('ul')
        $progressList.classList.add('nowprototypeit-progress-list')
        $progressBar.classList.add('nowprototypeit-progress-bar')
        $progressBar.setAttribute('max', '100')
        const $errorPanel = document.getElementById('panel-error')
        const $successPanel = document.getElementById('instructions-complete')

        ;[$errorPanel, $successPanel].forEach($panel => {
          $panel.parentNode.removeChild($panel)
          $panel.removeAttribute('hidden')
        })

        const updatesGiven = []

        function updateProgressDisplay (description, percentage) {
          if (updatesGiven.includes(description)) {
            incrementProgressBarByNumber($progressBar, 2)
            return
          }
          if (!elementsAdded) {
            $elem.innerHTML = ''
            $elem.appendChild($progressBar)
            $elem.appendChild($progressList)
          }
          updatesGiven.push(description)
          $progressBar.setAttribute('value', percentage)
          const $li = document.createElement('li')
          $li.innerText = description
          $progressBar.innerText = percentage + '%'
          $progressList.appendChild($li)
        }

        function runUpdate () {
          recursivelyGetUpdates(fetchUrl(config.actionUrl, 'POST'), (update) => {
            if (update.completed === true) {
              if (update.success === false) {
                updateProgressDisplay('Failed', 100)
                $elem.appendChild($errorPanel)
              } else {
                updateProgressDisplay('Completed', 100)
                $elem.appendChild($successPanel)
              }
            } else if (update.restarting === false) {
              updateProgressDisplay('Running command', 30)
            } else if (update.started === false) {
              updateProgressDisplay('Starting', 10)
            }
          })
        }

        if (config.startOnButtonPress) {
          document.getElementById(config.startOnButtonPress).addEventListener('click', (e) => {
            e.preventDefault()
            runUpdate()
          })
        } else {
          runUpdate()
        }
      }
    }

    const snakeCaseFromKebabCase = (input) => {
      const parts = input.toLowerCase().split('-')
      return parts.map((x, index) => index > 0 ? x[0].toUpperCase() + x.substring(1) : x).join('')
    }

    ;[...document.querySelectorAll('[data-dom-widget]')].forEach(($elem) => {
      const config = {}
      ;[...$elem.attributes].forEach(attr => {
        const prefix = 'data-'
        if (attr.name.startsWith(prefix)) {
          config[snakeCaseFromKebabCase(attr.name.substring(prefix.length))] = attr.value
        }
      })
      ;(domWidgets[config.domWidget] || function () {})($elem, config)
    })

    function recursivelyGetUpdates (fetchPromise, handler) {
      fetchPromise.then((response) => {
        response.json().then((json) => {
          handler(json)
          if (json.nextUrl) {
            recursivelyGetUpdates(fetchUrl(json.nextUrl, 'GET'), handler)
          }
        })
      }).catch(e => {
        console.log('Something went wrong with the request.')
        console.log(e)
      })
    }

    function fetchUrl (url, method) {
      return fetch(url, {
        method,
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        redirect: 'follow',
        referrerPolicy: 'origin',
        headers: {
          Accept: 'application/json'
        }
      })
    }
  }())
}
