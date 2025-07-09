(function captureBearerToken(xhr) {
  const XHR = xhr.prototype
  const open = XHR.open
  const send = XHR.send

  XHR.open = function (method, url) {
    this._url = url
    return open.apply(this, arguments)
  }

  XHR.send = function () {
    this.addEventListener('load', () => {
      if (this.responseText) {
        try {
          const body = JSON.parse(this.responseText)
          if (body && body.access_token) {
            window.postMessage({ type: 'BEARER_TOKEN', token: body.access_token }, '*')
          }
        } catch {
          // Silent fail
        }
      }
    })
    return send.apply(this, arguments)
  }
})(XMLHttpRequest)
