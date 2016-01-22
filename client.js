(function() {
  "use strict"

  function get(url) {
    var xhr = new XMLHttpRequest()
    xhr.open("get", url, false)
    xhr.send()
    if (xhr.status >= 400) throw new Error(url + ": " + xhr.statusText)
    return {url: xhr.responseURL, content: xhr.responseText}
  }

  var loaded = Object.create(null)

  function resolve(base, name) {
    base = base.slice(0, base.lastIndexOf("/") + 1)
    var rel = /^\.(\.?)\//, m
    while (m = rel.exec(name)) {
      if (m[1]) {
        var slash = base.lastIndexOf("/", base.length - 2)
        if (slash > 0 && base.slice(slash) != "../") base = base.slice(0, slash + 1)
        else base = base + "../"
      }
      name = name.slice(m[0].length)
    }
    return base + name
  }

  var resolved = Object.create(null)

  function Module(path, base) {
    this.exports = {}
    this.require = function(name) {
      if (/^\./.test(name)) name = resolve(path, name)
      else name = path + "/__mod/" + name
      if (name in resolved) name = resolved[name]
      if (name in loaded) return loaded[name]
      var resp = get(base + name.replace(/(^|\/)\.\.(?=$|\/)/g, "$1__").replace(/\.js$/, ""))
      var resolvedName = resp.url.match(/\/moduleserve\/mod(\/.*)/)[1].replace(/(^|\/)__(?=$|\/)/g, "$1..")
      if (resolvedName != name) resolved[name] = resolvedName
      name = resolvedName
      window.reqs =( window.reqs || 0) + 1
      if (name in loaded) return loaded[name]
      if (/\.json$/.test(name))
        return loaded[name] = JSON.parse(resp.content)
      var mod = new Module(name, base)
      loaded[name] = mod.exports
      ;(new Function("module, require, exports", resp.content + "\n//# sourceURL=" + name))(mod, mod.require, mod.exports)
      return loaded[name] = mod.exports
    }
  }

  var script = document.currentScript || document.querySelector("script[data-module]")
  var base = /^(.*)\/load\.js$/.exec(script.src)[1] + "/mod"
  new Module("/index", base).require(script.getAttribute("data-module"))
})()
