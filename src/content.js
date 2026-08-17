var bearerToken = null
var saqaraBearerToken = null
var saqaraModalEl = null

/**
 * Checks whether the current host matches the Saqara app domains.
 *
 * @function isSaqaraAppHost
 * @returns {boolean} True when running on a Saqara app host.
 */
function isSaqaraAppHost() {
  // Match any subdomain of saqara.com or go-aos.io (production, staging, preproduction, demo, etc.)
  return /(?:^|\.)((?:saqara\.com)|(?:go-aos\.io))$/i.test(window.location.hostname)
}

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
 * Creates a compact snackbar-style notification to copy the bearer.
 *
 * @function ensureSaqaraBearerModal
 * @returns {void}
 */
function ensureSaqaraBearerModal() {
  if (!isSaqaraAppHost()) return
  if (saqaraModalEl) return

  const snackbar = document.createElement('div')
  snackbar.style.position = 'fixed'
  snackbar.style.right = '16px'
  snackbar.style.top = '16px'
  snackbar.style.zIndex = '2147483647'
  snackbar.style.display = 'none'

  const inner = document.createElement('div')
  inner.setAttribute('role', 'alertdialog')
  inner.style.transform = 'translate(0px, 0px)'
  inner.style.transition = 'transform 225ms cubic-bezier(0, 0, 0.2, 1)'
  inner.style.background = '#393C44'
  inner.style.color = '#FAFAFA'
  inner.style.padding = '6px 8px'
  inner.style.borderRadius = '8px'
  inner.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)'
  inner.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif'
  inner.style.fontSize = '11px'
  inner.style.maxWidth = 'none'

  const content = document.createElement('div')
  content.style.display = 'flex'
  content.style.alignItems = 'center'
  content.style.gap = '8px'

  const title = document.createElement('div')
  title.textContent = 'Copier le bearer'
  title.style.fontWeight = '500'
  title.style.marginBottom = '0'
  title.style.whiteSpace = 'nowrap'

  const actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.alignItems = 'center'
  actions.style.gap = '6px'

  const copyBtn = document.createElement('button')
  copyBtn.setAttribute('aria-label', 'Copier le bearer')
  copyBtn.style.background = 'transparent'
  copyBtn.style.border = '1px solid rgba(250,250,250,0.3)'
  copyBtn.style.color = '#FAFAFA'
  copyBtn.style.padding = '4px'
  copyBtn.style.borderRadius = '6px'
  copyBtn.style.cursor = 'pointer'

  const copyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  copyIcon.setAttribute('width', '16')
  copyIcon.setAttribute('height', '16')
  copyIcon.setAttribute('viewBox', '0 0 24 24')
  copyIcon.setAttribute('fill', 'none')
  copyIcon.setAttribute('stroke', 'currentColor')
  copyIcon.setAttribute('stroke-width', '1.8')
  copyIcon.setAttribute('stroke-linecap', 'round')
  copyIcon.setAttribute('stroke-linejoin', 'round')

  const copyPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  copyPath1.setAttribute('x', '9')
  copyPath1.setAttribute('y', '9')
  copyPath1.setAttribute('width', '11')
  copyPath1.setAttribute('height', '11')
  copyPath1.setAttribute('rx', '2')
  copyPath1.setAttribute('ry', '2')

  const copyPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  copyPath2.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')

  copyIcon.append(copyPath1, copyPath2)
  copyBtn.appendChild(copyIcon)

  const status = document.createElement('span')
  status.style.fontSize = '10px'
  status.style.opacity = '0.7'
  status.style.whiteSpace = 'nowrap'

  copyBtn.addEventListener('click', async () => {
    if (!saqaraBearerToken) return
    try {
      await navigator.clipboard.writeText(saqaraBearerToken)
      status.textContent = 'Copié'
      setTimeout(() => { status.textContent = '' }, 2000)
    } catch {
      status.textContent = 'Échec de copie'
      setTimeout(() => { status.textContent = '' }, 2000)
    }
  })

  actions.append(copyBtn, status)
  content.append(title, actions)
  inner.appendChild(content)
  snackbar.appendChild(inner)
  document.body.appendChild(snackbar)

  saqaraModalEl = snackbar
}

/**
 * Displays the Saqara bearer notification if available.
 *
 * @function showSaqaraBearerModal
 * @returns {void}
 */
function showSaqaraBearerModal() {
  if (!isSaqaraAppHost()) return
  ensureSaqaraBearerModal()
  if (!saqaraModalEl) return

  saqaraModalEl.style.display = 'block'
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
  if (isSaqaraAppHost()) return

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
  if (!isSaqaraAppHost()) {
    observeUserTable()
    observeHeaderForInjection()
  }
})

// Listen for messages from the injected script to capture the bearer token
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (!event.data) return

  if (event.data.type === 'BEARER_TOKEN') {
    bearerToken = event.data.token
    console.log('[content.js] Bearer token received')
    checkAndSuggestRealmSwitch()
  }

  if (event.data.type === 'SAQARA_GRAPHQL_AUTH') {
    saqaraBearerToken = event.data.token
    showSaqaraBearerModal()
  }
})
