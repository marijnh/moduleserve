var module_ = require("module"), pth = require("path"), fs = require("fs")
var url_ = require("url")

function ModuleServer(options) {
  this.root = unwin(options.root)
  if (this.root.charAt(this.root.length - 1) != "/") this.root += "/"
  this.transform = options.transform
  this.cache = Object.create(null)
  this.nextTag = 0
  this.clientJS = fs.readFileSync(__dirname + "/client.js", "utf8")
  // A map of module paths to the module's filesystem path.
  this.resolved = Object.create(null)

  this.handleRequest = this.handleRequest.bind(this)
}
module.exports = ModuleServer

ModuleServer.prototype.handleRequest = function(req, resp) {
  var url = url_.parse(req.url)
  var handle = /^\/moduleserve\/(?:load\.js$|mod\/(.*))/.exec(url.pathname)
  if (!handle) return false

  var send = function(status, text, headers) {
    var hds = {"access-control-allow-origin": "*",
               "x-request-url": req.url}
    if (!headers || typeof headers == "string")
      hds["content-type"] = headers || "text/plain"
    else
      for (var prop in headers) hds[prop] = headers[prop]
    resp.writeHead(status, hds)
    resp.end(text)
  }

  // matched /moduleserve/load.js
  if (!handle[1]) {
    send(200, this.clientJS, "application/javascript")
    return true
  }

  // Modules paths in URLs represent "up one directory" as "__".
  // Convert them to ".." for filesystem path resolution.
  var path = undash(handle[1])
  var found = this.resolved[path]
  if (!found) {
    found = this.resolveModule(path) || this.resolveModule(path + ".js")
    if (!found) { send(404, "Not found"); return true }
    this.resolved[path] = found
  }

  if (found != path) {
    if (!(found in this.resolved)) this.resolved[found] = found
    if (found != path + ".js") {
      send(301, null, {location: "/moduleserve/mod/" + dash(found)})
      return true
    }
  } else if (/\.js$/.test(path) && found.indexOf(/[^\/]+\.js$/.exec(path)[0] + "/") > -1) {
    send(301, null, {location: "/moduleserve/mod/" + dash(found.slice(0, found.length - 3))})
    return true
  }

  var cached = this.cache[found]
  if (cached) {
    var noneMatch = req.headers["if-none-match"]
    if (noneMatch && noneMatch.indexOf(cached.headers.etag) > -1) send(304, null)
    else send(200, cached.content, cached.headers)
  } else {
    this.sendScript(found, send)
  }
  return true
}

function undash(path) { return path.replace(/(^|\/)__(?=$|\/)/g, "$1..") }
function dash(path) { return path.replace(/(^|\/)\.\.(?=$|\/)/g, "$1__") }

function resolve() { return unwin(pth.resolve.apply(pth, arguments)) }
function relative() { return unwin(pth.relative.apply(pth, arguments)) }
var unwin = pth.sep == "\\" ? function(s) { return s.replace(/\\/g, "/") } : function(s) { return s }

// Resolve a module path to a relative filepath where
// the module's file exists.
ModuleServer.prototype.resolveModule = function(path) {
  var localPath = resolve(this.root, path)
  var hasMod = localPath.indexOf("/__mod/"), parent, modPath, resolved
  if (hasMod > -1) {
    parent = localPath.slice(0, hasMod)
    modPath = localPath.slice(hasMod + 7)
  } else {
    parent = this.root
    modPath = localPath
  }

  var dummyMod = {
    id: parent,
    paths: module_._nodeModulePaths(parent).concat(module_.globalPaths)
  }
  try { resolved = unwin(module_._resolveFilename(modPath, dummyMod)) }
  catch(e) { return null }

  // Handle builtin modules resolving to strings like "fs", try again
  // with slash which makes it possible to locally install an equivalent.
  if (resolved.indexOf("/") == -1) {
    try { resolved = unwin(module_._resolveFilename(modPath + "/", dummyMod)) }
    catch(e) { return null }
  }

  return relative(this.root, resolved)
}

function Cached(file, content, headers) {
  this.file = file
  this.content = content
  this.headers = headers
}

// Send the script and cache the response in memory
// for future requests for the same module.
ModuleServer.prototype.sendScript = function(path, send) {
  var content, localPath = resolve(this.root, path)
  try { content = fs.readFileSync(localPath, "utf8") }
  catch(e) { return send(404, "Not found") }
  if (this.transform) content = this.transform(localPath, content)
  var headers = {
    "content-type": "application/javascript",
    "etag": '"' + (++this.nextTag) + '"'
  }
  this.cache[path] = new Cached(localPath, content, headers)
  // Bust the cache when the file changes.
  var watching = fs.watch(localPath, function() {
    watching.close()
    cache[path] = null
  }), cache = this.cache
  return send(200, content, headers)
}
