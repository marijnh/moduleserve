var module_ = require("module"), pth = require("path"), fs = require("fs")
var url_ = require("url")

var host = "localhost", port = 8080, dir = ".", transform = null

function usage() {
  console.log("Usage: moduleserve [--port port] [--host host] [--transform module] [dir]")
  process.exit(1)
}

for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i], next = process.argv[i + 1]
  if (arg == "--port" && next) { port = +next; i++ }
  else if (arg == "--host" && next) { host = next; i++ }
  else if (arg == "--transform" && next) { transform = next; i++ }
  else if (dir == "." && arg[0] != "-") dir = arg
  else usage()
}

var here = pth.resolve(dir)
if (here.charAt(here.length - 1) != "/") here += "/"

if (transform) {
  var transformMod = require(transform == "babel" ? "./babel-transform" : pth.resolve(transform))
  if (transformMod.init) transformMod.init(here)
  transform = transformMod.transform
}

var ecstatic = require("ecstatic")({root: here})
var client_js = fs.readFileSync(__dirname + "/client.js", "utf8")

var resolved = Object.create(null)

require("http").createServer(function(req, resp) {
  var url = url_.parse(req.url)
  var handle = /^\/moduleserve\/(?:load\.js$|mod\/(.*))/.exec(url.pathname)

  if (!handle) return ecstatic(req, resp)

  var send = function(status, text, headers) {
    var hds = {"access-control-allow-origin": "*"}
    if (!headers || typeof headers == "string")
      hds["content-type"] = headers || "text/plain"
    else
      for (var prop in headers) hds[prop] = headers[prop]
    resp.writeHead(status, hds)
    resp.end(text)
  }

  // matched /moduleserve/load.js
  if (!handle[1]) return send(200, client_js, "application/javascript")

  var path = undash(handle[1])
  var found = resolved[path]
  if (!found) {
    found = resolveModule(path)
    if (!found) return send(404, "Not found")
    resolved[path] = found
  }

  if (found != path) {
    if (!(found in resolved)) resolved[found] = found
    return send(301, null, {location: "/moduleserve/mod/" + dash(found)})
  }

  var cached = cache[found]
  if (cacheValid(cached)) {
    var noneMatch = req.headers["if-none-match"]
    if (noneMatch && noneMatch.indexOf(cached.headers.etag) > -1) return send(304, null)
    else return send(200, cached.content, cached.headers)
  }

  return sendScript(found, send)

}).listen(port, host)

function undash(path) { return path.replace(/(^|\/)__(?=$|\/)/g, "$1..") }
function dash(path) { return path.replace(/(^|\/)\.\.(?=$|\/)/g, "$1__") }

function resolveModule(path) {
  var localPath = pth.resolve(here, path)
  var hasMod = localPath.indexOf("/__mod/"), parent, modPath, resolved
  if (hasMod > -1) {
    parent = localPath.slice(0, hasMod)
    modPath = localPath.slice(hasMod + 7)
  } else {
    parent = here
    modPath = localPath
  }

  try {
    resolved = module_._resolveFilename(modPath, {
      id: parent,
      paths: module_._nodeModulePaths(parent).concat(module_.globalPaths)
    })
  } catch(e) { return null }

  if (resolved.indexOf("/") == -1 && path.charAt(path.length - 1) != "/")
    return resolveModule(path + "/")
  return pth.relative(here, resolved)
}

var cache = Object.create(null), nextTag = 0

function Cached(file, content, headers) {
  this.file = file
  this.content = content
  this.headers = headers
  this.mtime = +fs.statSync(file).mtime
}

function cacheValid(cache) {
  if (!cache) return false
  var stat
  try { stat = fs.statSync(cache.file) }
  catch(e) { return false }
  return +stat.mtime == cache.mtime
}

function sendScript(path, send) {
  var content, localPath = pth.resolve(here, path)
  try { content = fs.readFileSync(localPath, "utf8") }
  catch(e) { return send(404, "Not found") }
  if (transform) content = transform(localPath, content)
  var headers = {
    "content-type": "application/javascript",
    "etag": '"' + (++nextTag) + '"'
  }
  cache[path] = new Cached(localPath, content, headers)
  return send(200, content, headers)
}
