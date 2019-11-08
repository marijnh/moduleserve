var ModuleServer = require("./moduleserver")
var path = require("path")
var send = require("send")

var host = "localhost", port = 8080, dir = ".", transform = null, spaMode = false

function usage() {
  console.log("Usage: moduleserve [--port port] [--host host] [--transform module] [--spa] [dir]")
  process.exit(1)
}

for (var i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i], next = process.argv[i + 1]
  if (arg == "--port" && next) { port = +next; i++ }
  else if (arg == "--host" && next) { host = next; i++ }
  else if (arg == "--transform" && next) { transform = next; i++ }
  else if (arg == "--spa") { spaMode = true; i++ }
  else if (dir == "." && arg[0] != "-") dir = arg
  else usage()
}

// The root directory being served.
var root = path.resolve(dir)

if (transform) {
  var transformMod = require(transform == "babel" ? "./babel-transform" : path.resolve(transform))
  if (transformMod.init) transformMod.init(root)
  transform = transformMod.transform
}

var static = require("serve-static")(root)
var moduleServer = new ModuleServer({root: root, transform: transform}).handleRequest

// Create the server that listens to HTTP requests
// and returns module contents.
require("http").createServer(function(req, resp) {
  if (moduleServer(req, resp)) return
  static(req, resp, function next(err) {
    if (spaMode) {
      send(req, path.join(root, "index.html")).pipe(resp);
    } else {
      resp.statusCode = 404
      resp.end('Not found')
    }
  })
}).listen(port, host)

console.log("Module server listening on http://" + host + ":" + port)
