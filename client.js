(function() {
  "use strict"

  function get(url) {
    var xhr = new XMLHttpRequest()
    xhr.open("get", url, false)
    xhr.send()
    if (xhr.statusCode >= 300) throw new Error(url + ": " + xhr.statusText)
    return {path: xhr.getResponseHeader("x-moduleserve-path"), content: xhr.responseText}
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

  function Module(path, base) {
    this.exports = {}
    this.require = function(name) {
      var modPath = /^\./.test(name) ? "/path" + resolve(path, name) : "/mod/" + name
      if (modPath in loaded) return loaded[modPath]
      var resp = get(base + modPath.replace(/(^|\/)\.\.($|\/)/, "$1__$2"))
      var mod = new Module(resp.path, base)
      loaded[modPath] = mod.exports
      ;(new Function("module, require, exports", resp.content + "\n//# sourceURL=" + modPath))(mod, mod.require, mod.exports)
      return loaded[modPath] = mod.exports
    }
  }

  var script = document.currentScript || querySelector("script[data-module]")
  new Module("/index", /^(.*)\/load\.js$/.exec(script.src)[1]).require(script.getAttribute("data-module"))
})()
