# Moduleserve

This is a shim HTTP server for directly running your CommonJS (or ES6)
modules for development and testing (without a bundling step, and with
the compilation/transformation integrated in the server shim).

**Warnings:**

 * The server basically exposes your whole filesystem over HTTP. It
   binds to `"localhost"` by default, but if you bind it to something
   else or proxy in some uncautious way, you are putting yourself at
   risk.

 * This does everything syncronously, both on client and server.

 * This is a hack that I am using for my own development, not
   generally-useful, supported software. You might be able to make use
   of it, but if you run into a problem, you should try to debug it
   yourself, not ask me for help.

 * The code is likely to break if you do something that I'm not doing.
   Pull requests welcome!

## What it does

You run the server for a given directory...

    moduleserve demo/ --port 8080

It will start up an HTTP server on the given port, serving the content
of the `demo` directory statically. In addition, it exposes a URL
`/moduleserve/load.js`, which you use to load your main module:

    <script src="/moduleserve/load.js" data-module="./mymodule"></script>

That will pull in the client-side scaffolding and look for
`./mymodule`, resolved relative to the directory that the server is
running on. You can add a `data-require` attribute to the tag to have
it set a global `require` variable, which you can use to load modules
from the console.

That module is loaded as a
[CommonJS](http://wiki.commonjs.org/wiki/Modules/1.1) module, and may
use `require` with the regular node.js conventions (implicit `.js` or
`/index.js`, searching `node_modules`, etc). The intention is that,
contrary to systems like JSPM, you don't have to set up your project
to please this tool, but you can just directly use it on an npm-style
codebase.

You can pass `moduleserve` a `--transform` option, which should point
at a node module that defines a transformer. Such a transformer is
called on a file before it is served. It should export a `transform`
function that takes `(filename, text)` parameter and returns the
transformed text. If it also exports an `init` function, that is
called once with the target directory of the server.

If you pass `--transform babel`, you get a built-in transformer that
loads `babel` in the context of the target directory (i.e. you have to
have it installed locally there, or globally) that you're running the
tool on, and uses it to transform any files whose path does not
contain `node_modules/`.

If you pass `--spa`, every file path where no file can be found automatically will fall back to serving the `index.html`. This option allows you to implement routing for Single Page Applications.

The client is going to make a request for every single module file, so
for a bigger project the initial load is bound to be slow, especially
if you're using an expensive transform. The server then caches these
and sends 302 responses whenever possible, so assuming localhost-level
latency, subsequent loads should be faster.

## Source

This code is open-source under an MIT license. If you want to
contribute, create pull requests
[on GitHub](https://github.com/marijnh/moduleserve/).
