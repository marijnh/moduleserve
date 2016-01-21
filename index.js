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

require("http").createServer(function(req, resp) {
  var url = url_.parse(req.url)
  var handle = /^\/moduleserve\/(?:load\.js$|(mod|path)\/(.*))/.exec(url.pathname)

  if (!handle)
    return ecstatic(req, resp)

  var send = function(status, text, headers) {
    var hds = {"access-control-allow-origin": "*"}
    if (!headers || typeof headers == "string")
      hds["content-type"] = headers || "text/plain"
    else
      for (var prop in headers) hds[prop] = headers[prop]
    resp.writeHead(status, hds)
    resp.end(text)
  }

  if (!handle[1]) // /moduleserve/load.js
    return send(200, client_js, "application/javascript")
  var cached = (handle[1] == "mod" ? cachedMods : cachedFiles)[handle[2]]
  if (cacheValid(cached)) {
    var noneMatch = req.headers["if-none-match"]
    if (noneMatch && noneMatch.indexOf(cached.headers.etag) > -1) return send(304, null)
    else return send(200, cached.content, cached.headers)
  }
  if (handle[1] == "mod")
    return resolveMod(handle[2], send, req.headers["x-moduleserve-parent"])
  else if (handle[1] == "path")
    resolveFile(handle[2], send)
}).listen(port, host)

var cachedMods = Object.create(null)
var cachedFiles = Object.create(null)
var nextTag = 0

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

function dotify(path) {
  return path.replace(/(^|\/)__($|\/)/, "$1..$2")
}

function resolveFile(path, send) {
  var localPath = pth.resolve(here, dotify(path))
  if (/\.js(on)?$/.test(localPath) && fs.existsSync(localPath))
    ; // Already proper path
  else if (fs.existsSync(localPath + ".js"))
    localPath += ".js"
  else if (fs.existsSync(localPath + "/index.js"))
    localPath += "/index.js"
  else
    return send(404, "Not found")
  return sendScript(send, path, localPath, cachedFiles)
}

function resolveMod(path, send, parent) {
  var resolved, parentPath = pth.resolve(here, parent)
  try {
    resolved = module_._resolveFilename(path, {
      id: parentPath,
      paths: module_._nodeModulePaths(parentPath).concat(module_.globalPaths)
    })
  } catch(e) { return send(404, "Not found") }
  // Work around Node returning simply strings for built-in modules
  if (resolved.charAt(0) != "/" && path.charAt(path.length - 1) != "/")
    return resolveMod(path + "/", send, parent)
  return sendScript(send, path, resolved, cachedMods)
}

function sendScript(send, path, localPath, cache) {
  var content
  try { content = fs.readFileSync(localPath, "utf8") }
  catch(e) { return send(404, "Not found") }
  if (transform) content = transform(localPath, content)
  var headers = {
    "content-type": "application/javascript",
    "x-moduleserve-path": "/" + pth.relative(here, localPath.replace(/\.\w+$/, "")),
    "etag": '"' + (++nextTag) + '"'
  }
  cache[path] = new Cached(localPath, content, headers)
  return send(200, content, headers)
}
