(function() {
  "use strict"

  // Make a synchronous HTTP request for a module.
  function get(url) {
    var xhr = new XMLHttpRequest()
    xhr.open("get", url, false)
    xhr.send()
    if (xhr.status >= 400) throw new Error(url + ": " + xhr.statusText)
    return {url: xhr.responseURL, content: xhr.responseText}
  }

  // A key-value map of all loaded modules.
  var loaded = Object.create(null)

  // Resolve a submodule path with its parent module's,
  // resulting in module path relative to the root module.
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

  // A cache of resolved module paths.
  var resolved = Object.create(null)

  // A module, which can load submodules.
  function Module(path, base) {
    this.exports = {}
    // Load a submodule of this module.
    this.require = function(name) {
      if (/^\./.test(name)) name = resolve(path, name)
      else name = path + "/__mod/" + name
      if (name in resolved) name = resolved[name]
      if (name in loaded) return loaded[name]
      // Modify the module path for the request,
      // changing up one directory ("..") to "__".
      var resp = get(base + name.replace(/(^|\/)\.\.(?=$|\/)/g, "$1__").replace(/\.js$/, ""))
      var resolvedName = resp.url.match(/\/moduleserve\/mod(\/.*)/)[1].replace(/(^|\/)__(?=$|\/)/g, "$1..")
      if (resolvedName != name) resolved[name] = resolvedName
      name = resolvedName
      window.reqs =( window.reqs || 0) + 1
      if (name in loaded) return loaded[name]
      if (/\.json$/.test(name))
        return loaded[name] = JSON.parse(resp.content)
      // Create the module and evaluate its code,
      // which recursively loads submodules.
      var mod = new Module(name, base)
      loaded[name] = mod.exports
      evalFunction(resp.content, name)(mod, mod.require, mod.exports)
      return loaded[name] = mod.exports
    }
  }

  // Wrap JavaScript module code in a module encapsulating function
  // and return the function, evaluated.
  function evalFunction(content, name) {
    var prefix = "(function(module, require, exports){", suffix = "\n})"
    if (!/\/\/#/.test(content)) content += "\n//# sourceURL=" + name
    return (0, eval)(prefix + content + suffix)
  }

  var script = document.currentScript || document.querySelector("script[data-module]")
  var base = /^(.*)\/load\.js$/.exec(script.src)[1] + "/mod"
  // Create a root module and require the main module
  // defined in the "data-module" attribute.
  new Module("/index", base).require(script.getAttribute("data-module"))
})()
