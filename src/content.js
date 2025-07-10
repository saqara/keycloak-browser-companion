var bearerToken = null

/**
 * Adds an "Impersonate" link to each user row in the Keycloak admin Users table.
 *
 * Finds the table with aria-label="Users", iterates over its rows, and for each user link
 * extracts the realm and user ID. It then appends a new table cell containing an
 * "Impersonate" anchor. Clicking this link issues a POST request to the
 * `/auth/admin/realms/{realm}/users/{userId}/impersonation` endpoint using the global
 * `bearerToken`. If successful, it opens the returned redirect URL in a new browser tab;
 * otherwise it shows an alert with an error message.
 *
 * @function addImpersonateLink
 * @returns {void}
 */
function addImpersonateLink() {
  const userTable = document.querySelector('table[aria-label="Users"]')
  if (!userTable) return

  const rows = userTable.querySelectorAll('tr')
  rows.forEach((row) => {
    const secondTd = row.querySelector('td:nth-child(2) a[href^="#/"][href*="/users/"]')
    if (!secondTd) return

    const href = secondTd.getAttribute('href')
    const match = href.match(/#\/(.+?)\/users\/(.+?)\/settings/)
    if (!match) return

    const realm = match[1]
    const uuid = match[2]

    // Avoid duplicate links
    if (row.querySelector('a[href="#"]')) return

    const impersonateCell = document.createElement('td')
    const impersonateLink = document.createElement('a')
    impersonateLink.href = '#'
    impersonateLink.textContent = 'Impersonate'

    impersonateLink.addEventListener('click', async (e) => {
      e.preventDefault()
      if (!bearerToken) {
        alert('Bearer token not available. Please try again later.')
        return
      }
      const redirectUrl = await impersonateUser(realm, uuid, bearerToken)
      if (redirectUrl) {
        window.open(redirectUrl, '_blank')
      } else {
        alert('Failed to impersonate or no redirect URL was provided.')
      }
    })
    impersonateCell.appendChild(impersonateLink)
    row.appendChild(impersonateCell)
  })
}

/**
 * Observes the document body for mutations and watches for the Users table to be added.
 * Once the table is detected, invokes the addImersonateLink function to insert impersonation links.
 *
 * @function observeUserTable
 * @returns {void}
 */
function observeUserTable() {
  const observer = new MutationObserver(() => {
    const userTable = document.querySelector('table[aria-label="Users"]')
    if (userTable) addImpersonateLink()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

/**
 * Injects a script element into the current document to load and execute
 * the extension's `inject.js` file, and removes the script element once loaded.
 *
 * The script is appended to the document's <head> if available, otherwise
 * to the root <html> element.
 *
 * @returns {void}
 */
function injectXHRInspector() {
  const scriptEl = document.createElement('script')
  scriptEl.src = chrome.runtime.getURL('inject.js')
  scriptEl.onload = function () { this.remove() };
  (document.head || document.documentElement).append(scriptEl)
}

/**
 * Asynchronously monitors the Keycloak admin UI for the current realm, and if running under
 * the "master" realm with a valid bearer token, fetches the list of available realms to
 * suggest switching to the other realm when exactly two are present.
 *
 * The function:
 * 1. Waits for an element with data-testid="currentRealm" to appear in the DOM.
 * 2. Reads its text content to determine the active realm.
 * 3. Returns immediately if the active realm is not "master" or if no global `bearerToken` is set.
 * 4. Makes an authenticated GET request to `/auth/admin/realms/master/ui-ext/realms/names`
 *    to retrieve up to 11 realm names.
 * 5. If the response contains exactly two realms (including "master"), finds the non-master realm
 *    and invokes `showRealmSwitchPrompt(otherRealmName)` to prompt the user to switch.
 * 6. Fails silently on network or parsing errors.
 *
 * @async
 * @function checkAndSuggestRealmSwitch
 * @returns {Promise<void>} Resolves when the check (and possible prompt) completes; never rejects.
 *
 * @global {string} bearerToken  A valid Keycloak access token, expected to be defined in the global scope.
 */
async function checkAndSuggestRealmSwitch() {
  // Wait for the current realm span to be present
  const waitForCurrentRealm = () => new Promise(resolve => {
    const tryFind = () => {
      const el = document.querySelector('span[data-testid="currentRealm"]')
      if (el) resolve(el)
      else setTimeout(tryFind, 100)
    }
    tryFind()
  })

  const currentRealmEl = await waitForCurrentRealm()
  const currentRealm = currentRealmEl.textContent.trim()

  if (currentRealm !== 'master') return
  if (!bearerToken) return

  try {
    const resp = await fetch('/auth/admin/realms/master/ui-ext/realms/names?first=0&max=11&search=', {
      headers: { 'Authorization': 'Bearer ' + bearerToken },
    })

    if (!resp.ok) return
    const realms = await resp.json()

    console.log('[content.js] Realms list fetched:', realms)
    console.log('[content.js] Current realm:', currentRealm)

    if (Array.isArray(realms) && realms.length === 2 && currentRealm === 'master') {
      const otherRealm = realms.find(r => r.name !== 'master')
      if (otherRealm) {
        if (confirm(`Vous êtes sur le realm par défaut (master). Voulez-vous basculer vers ${otherRealm.name} ?`)) {
          window.location.href = `/auth/admin/master/console/#/${otherRealm.name}`
        }
      }
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Performs a user impersonation request to the Keycloak admin API.
 *
 * @async
 * @function impersonateUser
 * @param {string} realm - The realm name.
 * @param {string} uuid - The user ID to impersonate.
 * @param {string} bearerToken - The Keycloak access token.
 * @returns {Promise<string|null>} The redirect URL if successful, null otherwise.
 */
async function impersonateUser(realm, uuid, bearerToken) {
  const impersonationUrl = `/auth/admin/realms/${realm}/users/${uuid}/impersonation`
  const payload = { user: uuid, realm: realm }
  try {
    const response = await fetch(impersonationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + bearerToken,
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    return data.redirect || null
  } catch (error) {
    return null
  }
}

/**
 * Injects a button next to the user details page header if the header is found.
 *
 * @function injectButtonNextToHeader
 * @returns {void}
 */
function injectButtonNextToHeader(headerElement) {
  if (!headerElement) {
    return
  }

  const button = document.createElement('button')
  button.className = 'pf-m-secondary'
  button.textContent = 'Impersonate'

  button.addEventListener('click', async () => {
    if (!bearerToken) {
      alert('Bearer token not available. Please try again later.')
      return
    }

    // Extract realm and user ID from the URL
    const urlMatch = window.location.href.match(/#\/(.+?)\/users\/(.+?)\/settings/)
    if (!urlMatch) {
      alert('Failed to extract user ID or realm from the URL.')
      return
    }

    const realm = urlMatch[1]
    const userId = urlMatch[2]

    const redirectUrl = await impersonateUser(realm, userId, bearerToken)
    if (redirectUrl) {
      window.open(redirectUrl, '_blank')
    } else {
      alert('Failed to impersonate or no redirect URL was provided.')
    }
  })

  // Insert the button next to the header element
  headerElement.parentNode.insertBefore(button, headerElement.nextSibling)
}

function observeHeaderForInjection() {
  const observer = new MutationObserver(() => {
    const headerElement = document.querySelector('h1.kc-username-view-header')
    if (headerElement && !headerElement.dataset.buttonInjected) {
      injectButtonNextToHeader(headerElement)
      headerElement.dataset.buttonInjected = 'true' // Mark the header to avoid duplicate buttons
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

// Initialize the script when the window loads
window.addEventListener('load', () => {
  injectXHRInspector()
  observeUserTable()
  observeHeaderForInjection()
})

// Listen for messages from the injected script to capture the bearer token
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data && event.data.type === 'BEARER_TOKEN') {
    bearerToken = event.data.token
    console.log('[content.js] Bearer token received')
    checkAndSuggestRealmSwitch()
  }
})
