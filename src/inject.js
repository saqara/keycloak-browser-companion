(function captureBearerTokenAndGraphqlAuth(xhr) {
  const XHR = xhr.prototype
  const open = XHR.open
  const send = XHR.send
  const setRequestHeader = XHR.setRequestHeader

  XHR.open = function (method, url) {
    this._url = url
    this._requestHeaders = this._requestHeaders || {}
    return open.apply(this, arguments)
  }

  XHR.setRequestHeader = function (header, value) {
    this._requestHeaders = this._requestHeaders || {}
    this._requestHeaders[header.toLowerCase()] = value
    return setRequestHeader.apply(this, arguments)
  }

  XHR.send = function () {
    const url = this._url || ''
    const authHeader = this._requestHeaders && this._requestHeaders['authorization']

    if (url.includes('/graphql') && authHeader) {
      window.postMessage({ type: 'SAQARA_GRAPHQL_AUTH', token: authHeader }, '*')
    }

    this.addEventListener('load', () => {
      try {
        if (this.responseType && this.responseType !== 'text') return
        if (this.responseText) {
          const body = JSON.parse(this.responseText)
          if (body && body.access_token) {
            window.postMessage({ type: 'BEARER_TOKEN', token: body.access_token }, '*')
          }
        }
      } catch {
        // Silent fail
      }
    })
    return send.apply(this, arguments)
  }
})(XMLHttpRequest)(function captureFetchGraphqlAuth(fetchFn) {
  if (!fetchFn) return

  const originalFetch = fetchFn
  window.fetch = function (input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || ''
      const headers = init.headers || (input && input.headers) || {}

      let authHeader = null
      if (typeof headers.get === 'function') {
        authHeader = headers.get('authorization')
      } else if (Array.isArray(headers)) {
        const found = headers.find(([key]) => String(key).toLowerCase() === 'authorization')
        authHeader = found ? found[1] : null
      } else if (typeof headers === 'object') {
        const key = Object.keys(headers).find(k => k.toLowerCase() === 'authorization')
        authHeader = key ? headers[key] : null
      }

      if (url.includes('/graphql') && authHeader) {
        window.postMessage({ type: 'SAQARA_GRAPHQL_AUTH', token: authHeader }, '*')
      }
    } catch {
      // Silent fail
    }

    return originalFetch.apply(this, arguments)
  }
})(window.fetch)
