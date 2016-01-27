var module_ = require("module")
var babel

exports.init = function(path) {
  var dummyMod = {
    id: path,
    paths: module_._nodeModulePaths(path).concat(module_.globalPaths)
  }
  var resolved = module_._resolveFilename("babel-core", dummyMod)
  babel = require(resolved)
}

exports.transform = function(path, text) {
  if (/node_modules\//.test(path)) return text
  try {
    return babel.transform(text, {filename: path, sourceMaps: "inline"}).code
  } catch(e) {
    return "console.error(" + JSON.stringify(e + "") + ")"
  }
}
