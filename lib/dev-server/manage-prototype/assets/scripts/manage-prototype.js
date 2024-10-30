window.NOW_PROTOTYPE_IT = window.NOW_PROTOTYPE_IT || {}
window.NOW_PROTOTYPE_IT.AUTH_FUNCTIONS = window.NOW_PROTOTYPE_IT.AUTH_FUNCTIONS || {}
;(function () {
  const windowReferences = {}

  if (window.nowPrototypeItDesignSystem && window.nowPrototypeItDesignSystem.setupDomWidgets) {
    window.nowPrototypeItDesignSystem.setupDomWidgets({
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
        $progressList.classList.add('nowprototypeit-bullet-list')
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
            incrementProgressBarByNumberWithMaximum($progressBar, 2, 80)
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
          recursivelyGetUpdates(config.actionUrl, 'POST', (update) => {
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
      },
      'pin-to-page-top-on-scroll': ($elem, config) => {
        const pinnedClass = 'nowprototypeit-pinned'
        const distanceFromTop = Number(config.distanceFromTop || 0)
        let offset
        const readOffset = () => {
          const hadClass = $elem.classList.contains(pinnedClass)
          $elem.classList.remove(pinnedClass)
          offset = $elem.offsetTop
          if (hadClass) {
            $elem.classList.add(pinnedClass)
          }
        }

        window.addEventListener('resize', debounceEnd(() => {
          readOffset()
        }, 300))

        window.addEventListener('scroll', () => {
          const scrollY = window.scrollY
          const pxToAdd = Math.max(0, scrollY - offset + distanceFromTop)
          $elem.style.top = pxToAdd + 'px'
        })

        readOffset()
        $elem.classList.add(pinnedClass)
      },
      'auth-process-open-window': ($elem, config) => {
        const url = $elem.getAttribute('href')
        $elem.addEventListener('click', (e) => {
          try {
            open()
            e.preventDefault()
          } catch (e) {
            console.log('Error opening login window, allowing default behaviour')
            console.log(e)
          }
        })
        if (config.autoOpen === 'on') {
          open()
        }

        function open () {
          windowReferences.login = window.open(url, 'NPIAuthLoginWindow', 'width=800,height=600')
          windowReferences.login.focus()
        }
      },
      prototypeUploadProgressMessage: ($elem, config) => {
        const statusId = config.statusId
        if (!statusId) {
          console.error('Failed to find statusId in config')
        }
        console.log('config', config)

        const $tooLongMessage = document.getElementById(config.tooLongMessageId)
        let lastMessage
        let tooLongMessageTimeout

        function resetTooLongMessage () {
          console.log('resetting message')
          if (!$tooLongMessage) {
            return
          }
          if (tooLongMessageTimeout) {
            clearTimeout(tooLongMessageTimeout)
          }
          $tooLongMessage.style.display = 'none'
          tooLongMessageTimeout = setTimeout(() => {
            $tooLongMessage.style.display = 'block'
          }, 15000)
        }

        function fetchMessageAndUpdate () {
          fetch(`/manage-prototype/hosting/upload-progress-ajax?statusId=${encodeURIComponent(statusId)}`)
            .then(result => {
              if (result.status === 200) {
                return result.json()
              }
              throw new Error('Failed to get progress')
            })
            .then(json => {
              console.log('json', json)
              if (json.appIsReady && json.prototypeName) {
                window.location.href = `/manage-prototype/hosting?splash=success&appName=${encodeURIComponent(json.prototypeName)}`
              }
              return json.message
            })
            .then(message => {
              if (message !== lastMessage) {
                $elem.innerText = message
                lastMessage = message
                resetTooLongMessage()
                setTimeout(fetchMessageAndUpdate, 2000)
              } else {
                setTimeout(fetchMessageAndUpdate, 500)
              }
            })
            .catch(err => {
              console.error(err)
              setTimeout(fetchMessageAndUpdate, 500)
            })
        }

        fetchMessageAndUpdate()
      },
      replaceElementsOnSubmit: ($elem, config) => {
        const $replaceElem = document.getElementById(config.replaceElem)
        const $withElem = document.getElementById(config.withElem)
        const $alsoHideElems = [...document.getElementsByClassName(config.alsoHideClass)]
        $elem.addEventListener('submit', (e) => {
          $replaceElem.style.display = 'none'
          $withElem.style.display = 'block'
          $alsoHideElems.forEach($alsoHide => {
            $alsoHide.style.display = 'none'
          })
        })
      }
    })
  }

  function recursivelyGetUpdates (url, method, handler) {
    const maxFailures = 10
    let failures = 0
    const fetchPromise = fetchUrl(url, method)
    fetchPromise.then((response) => {
      response.json().then((json) => {
        handler(json)
        if (json.nextUrl) {
          recursivelyGetUpdates(json.nextUrl, 'GET', handler)
        }
      })
    }).catch(e => {
      console.log('Something went wrong with the request.')
      console.log(e)
      if (failures++ < maxFailures) {
        setTimeout(() => {
          recursivelyGetUpdates(url, method, handler)
        }, 1000)
      }
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

  function incrementProgressBarByNumberWithMaximum ($progressBar, increment, maximum) {
    const currentValue = parseInt($progressBar.getAttribute('value'), 10)
    let newValue = currentValue + increment
    if (newValue > maximum) {
      newValue = maximum
    }
    $progressBar.setAttribute('value', '' + newValue)
  }

  function debounceEnd (fn, time) {
    let timeout
    return function () {
      clearTimeout(timeout)
      timeout = setTimeout(fn, time)
    }
  }

  const phaseOneContent = document.getElementById('phase-one') || { style: {} }
  const phaseTwoContent = document.getElementById('phase-two') || { style: {} }

  function checkForUpdates (url) {
    fetch(url)
      .then((response) => response.json())
      .then((json) => {
        if (phaseOneContent && phaseTwoContent) {
          if (json.started) {
            phaseOneContent.style.display = 'none'
            phaseTwoContent.style.display = 'block'
          }
        }
        if (json.completed) {
          if (windowReferences.login) {
            windowReferences.login.close()
          }
        }
        if (json.redirectToUrl) {
          window.location.href = json.redirectToUrl
          return
        }
        pollAgain()
      })
      .catch(e => {
        console.log('Something went wrong with the request.')
        console.log(e)
        pollAgain()
      })

    function pollAgain () {
      setTimeout(() => {
        checkForUpdates(url)
      }, 1000)
    }
  }

  window.NOW_PROTOTYPE_IT.AUTH_FUNCTIONS.checkForUpdates = checkForUpdates
})()
