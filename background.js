chrome.contextMenus.removeAll(function () {
  chrome.contextMenus.create({
    title: 'Copy to SiYuan',
    contexts: ['selection', 'image'],
    onclick: function (info, tab) {
      chrome.tabs.sendMessage(tab.id, {
        'func': 'copy',
        'tabId': tab.id,
        'srcUrl': info.srcUrl,
      })
    },
  })
})

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    let existAllowOrigin = false
    for (let i = 0; i < details.responseHeaders.length; i++) {
      if ('access-control-allow-origin' ===
        details.responseHeaders[i].name.toLowerCase()) {
        existAllowOrigin = true
        break
      }
    }

    if (!existAllowOrigin) {
      const cors = {name: 'Access-Control-Allow-Origin', value: '*'}
      return {responseHeaders: details.responseHeaders.concat(cors)}
    }
    return {responseHeaders: details.responseHeaders}
  },
  {
    urls: ['*://*/*'],
  },
  ['blocking', 'responseHeaders', 'extraHeaders'],
)

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.func !== 'upload-copy') {
    return
  }
  const dom = request.dom
  const files = request.files
  const formData = new FormData()
  formData.append('dom', dom)
  for (const key of Object.keys(files)) {
    const data = files[key].data
    const base64Response = await fetch(data)
    const blob = base64Response.blob()
    formData.append(key, await blob)
  }

  fetch(request.api + '/api/extension/copy', {
    method: 'POST',
    headers: {
      'Authorization': 'Token ' + request.token,
    },
    body: formData,
  }).then((response) => {
    if (response.redirected) {
      chrome.tabs.sendMessage(request.tabId, {
        'func': 'tip',
        'msg': 'Invalid API token',
        'tip': 'tip',
      })
    }
    return response.json()
  }).then((response) => {
    if (response.code < 0) {
      chrome.tabs.sendMessage(request.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': request.tip,
      })
      return
    }

    chrome.tabs.sendMessage(request.tabId, {
      'func': 'copy2Clipboard',
      'data': response.data.md,
    })

    if ('' !== response.msg && request.type !== 'article') {
      chrome.tabs.sendMessage(request.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': request.tip,
      })
    }

    if (request.type === 'article') {
      let title =  request.title ? ('/' + request.title) : 'Untitled'
      title = title.replaceAll("/", "")

      fetch(request.api + '/api/filetree/createDocWithMd', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + request.token,
        },
        body: JSON.stringify({
          'notebook': request.notebook,
          'path': title,
          'markdown': response.data.md,
        }),
      }).then((response) => {
        return response.json()
      }).then((response) => {
        chrome.tabs.sendMessage(request.tabId, {
          'func': 'tip',
          'msg': "Create article successfully",
          'tip': request.tip,
        })
      })
    }
  }).catch((e) => {
    console.warn(e)
  })
})
