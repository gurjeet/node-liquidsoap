var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("util", function (require, module, exports, __dirname, __filename) {
var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

});

require.define("events", function (require, module, exports, __dirname, __filename) {
if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/request.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Blank, Client, Fallback, Input, Metadata, Output, Request, Single, changeMetadata, checkState, client, opts, pushRequest, sources, _ref;

  _ref = require("./liquidsoap"), Client = _ref.Client, Request = _ref.Request, Output = _ref.Output, Input = _ref.Input, Metadata = _ref.Metadata, Fallback = _ref.Fallback, Single = _ref.Single, Blank = _ref.Blank;

  opts = {
    auth: "test:test",
    host: "localhost",
    port: 8080
  };

  client = new Client(opts);

  sources = {
    foo: {
      type: Output.Ao,
      source: {
        type: Metadata.Get,
        source: {
          type: Metadata.Set,
          source: {
            type: Fallback,
            sources: {
              request1: {
                type: Request.Queue
              },
              request2: {
                type: Request.Queue
              },
              radiopi: {
                type: Input.Http,
                uri: "http://radiopi.org:8080/reggae",
                autostart: false
              }
            }
          }
        }
      }
    },
    bar: {
      type: Blank,
      duration: 3
    },
    bla: {
      type: Single,
      uri: "say:it works!"
    }
  };

  pushRequest = function(source, request, fn) {
    return source.push(request, function(err) {
      if (err != null) {
        return console.log("Error pushing request to request source");
      }
      return fn();
    });
  };

  changeMetadata = function(source, value, fn) {
    var cb, get_meta, set_meta;
    set_meta = function(next) {
      console.log("Setting artist to \"" + value + "\" on source " + source.name);
      return source.set_metadata({
        artist: value
      }, function(err) {
        if (err != null) return "Error setting metadata.";
        if (next != null) return setTimeout(next, 500);
      });
    };
    get_meta = function(next) {
      return source.get_metadata(function(err, res) {
        if (err != null) return console.log("Error grabbing metadata");
        console.log("Latest metadata on " + source.name + ": \n" + (JSON.stringify(res, void 0, 2)));
        if (next != null) return setTimeout(next, 500);
      });
    };
    cb = function() {
      return get_meta(function() {
        return set_meta(function() {
          return get_meta(function() {
            return fn();
          });
        });
      });
    };
    return setTimeout(cb, 1000);
  };

  checkState = function(source, fn) {
    return source.status(function(err, res) {
      if (err != null) return fn(err);
      console.log("Current status for " + source.name + ":");
      console.dir(res);
      return source.start(function(err) {
        if (err != null) return fn(err);
        return source.status(function(err, res) {
          console.log("New status for " + source.name + ":");
          console.dir(res);
          return fn(null);
        });
      });
    });
  };

  client.create(sources, function(err, sources) {
    var dummy;
    if (err != null) {
      console.log("Error while creating sources:");
      return console.dir(err);
    }
    dummy = {
      dummy: {
        type: Output.Dummy,
        source: sources.bar
      }
    };
    client.create(dummy, function(err) {
      if (err != null) {
        console.log("Error while creating dummy source.");
        return console.dir(err);
      }
    });
    if (err != null) {
      console.log("Error while creating sources:");
      return console.dir(err);
    }
    return pushRequest(sources.request1, "/tmp/foo.mp3", function() {
      return pushRequest(sources.request2, "/tmp/bla.mp3", function() {
        return changeMetadata(sources.foo, "foo", function() {
          return sources.request1.skip(function(err) {
            if (err != null) {
              console.log("Error while skipping on request1:");
              return console.dir(err);
            }
            return sources.bar.shutdown(function(err) {
              if (err != null) {
                console.log("Error while shutting bar (dummy) source down:");
                return console.dir(err);
              }
              return checkState(sources.radiopi, function(err) {
                if (err != null) {
                  console.log("Error while checking radiopi's status:");
                  console.dir(err);
                }
                return sources.foo.skip(function(err) {
                  if (err != null) {
                    console.log("Error while skipping on fallback:");
                    return console.dir(err);
                  }
                  return console.log("All Good Folks!");
                });
              });
            });
          });
        });
      });
    });
  });

}).call(this);

});

require.define("/liquidsoap.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Source, Stateful, b64, chain, mixin, stringify, _ref;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  _ref = require("./utils"), b64 = _ref.b64, chain = _ref.chain, stringify = _ref.stringify, mixin = _ref.mixin;

  module.exports.Client = (function() {

    function Client(opts) {
      this.opts = opts;
      this.http_request = __bind(this.http_request, this);
      this.auth = opts.auth;
      this.host = opts.host;
      if (opts.scheme === "http") {
        this.http = require("http");
      } else {
        this.http = require("https");
      }
      this.port = opts.port || 80;
    }

    Client.prototype.http_request = function(opts, fn) {
      var expects, headers, query, req;
      expects = opts.expects || 200;
      query = opts.query;
      headers = {
        "Accept": "application/json"
      };
      if (this.auth != null) {
        headers["Authorization"] = "Basic " + (b64(this.auth));
      }
      opts = {
        host: this.host,
        port: this.port,
        method: opts.method,
        path: opts.path,
        headers: headers
      };
      if (query != null) {
        query = JSON.stringify(query);
        opts.headers["Content-Type"] = "application/json";
        opts.headers["Content-Length"] = query.length;
      }
      req = this.http.request(opts, function(res) {
        var data;
        data = "";
        res.on("data", function(buf) {
          return data += buf;
        });
        return res.on("end", function() {
          try {
            data = JSON.parse(data);
          } catch (err) {

          }
          if (res.statusCode !== expects) {
            err = {
              code: res.statusCode,
              data: data,
              options: opts
            };
            return fn(err, null);
          }
          return fn(null, data);
        });
      });
      return req.end(query);
    };

    Client.prototype.create = function(sources, fn) {
      var exec, res;
      var _this = this;
      res = {};
      exec = function(params, name, fn) {
        if (params == null) return fn(null);
        if (params.type == null) {
          res[name] = params;
          return fn(null);
        }
        return chain(params.sources, exec, function(err) {
          if (err != null) return fn(err);
          return exec(params.source, name, function(err) {
            var callback, source;
            if (err != null) return fn(err);
            source = res[name] || _this;
            callback = function(err, source) {
              if (err != null) return fn(err);
              res[name] = source;
              return fn(null);
            };
            if (params.source != null) {
              return params.type.create(source, params, callback);
            } else {
              return params.type.create(name, source, params, callback);
            }
          });
        });
      };
      return chain(sources, exec, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Client;

  })();

  Source = (function() {

    function Source() {}

    Source.create = function(name, dst, src) {
      var res;
      if (src == null) {
        src = dst;
        dst = name;
        name = src.name;
      }
      res = new dst;
      res.name = name;
      mixin(src, res);
      return res;
    };

    Source.prototype.skip = function(fn) {
      return this.http_request({
        method: "POST",
        path: "/sources/" + this.name + "/skip"
      }, fn);
    };

    Source.prototype.shutdown = function(fn) {
      return this.http_request({
        method: "DELETE",
        path: "/sources/" + this.name
      }, fn);
    };

    return Source;

  })();

  module.exports.Blank = (function() {
    var _this = this;

    __extends(Blank, Source);

    function Blank() {
      Blank.__super__.constructor.apply(this, arguments);
    }

    Blank.create = function(name, source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(name, Blank, source);
      return res.http_request({
        method: "PUT",
        path: "/blank/" + res.name,
        query: opts.duration || 0
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Blank;

  }).call(this);

  module.exports.Single = (function() {
    var _this = this;

    __extends(Single, Source);

    function Single() {
      Single.__super__.constructor.apply(this, arguments);
    }

    Single.create = function(name, source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(name, Single, source);
      return res.http_request({
        method: "PUT",
        path: "/single/" + res.name,
        query: opts.uri || 0
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Single;

  }).call(this);

  module.exports.Input = {};

  module.exports.Input.Http = (function() {
    var _this = this;

    __extends(Http, Source);

    function Http() {
      Http.__super__.constructor.apply(this, arguments);
    }

    Http.create = function(name, source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(name, Http, source);
      mixin(Stateful, res);
      return res.http_request({
        method: "PUT",
        path: "/input/http/" + res.name,
        query: stringify(opts)
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Http;

  }).call(this);

  module.exports.Request = {};

  module.exports.Request.Queue = (function() {
    var _this = this;

    __extends(Queue, Source);

    function Queue() {
      this.push = __bind(this.push, this);
      Queue.__super__.constructor.apply(this, arguments);
    }

    Queue.create = function(name, client, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(name, Queue, client);
      return res.http_request({
        method: "PUT",
        path: "/request/queue/" + res.name
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    Queue.prototype.push = function(requests, fn) {
      if (!(requests instanceof Array)) requests = [requests];
      return this.http_request({
        method: "POST",
        path: "/sources/" + this.name + "/requests",
        query: requests
      }, fn);
    };

    return Queue;

  }).call(this);

  module.exports.Fallback = (function() {
    var _this = this;

    __extends(Fallback, Source);

    function Fallback() {
      Fallback.__super__.constructor.apply(this, arguments);
    }

    Fallback.create = function(name, client, opts, fn) {
      var key, options, res, source, sources;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(name, Fallback, client);
      sources = (function() {
        var _ref2, _results;
        _ref2 = opts.sources;
        _results = [];
        for (key in _ref2) {
          source = _ref2[key];
          _results.push(key);
        }
        return _results;
      })();
      options = opts.options || [];
      return res.http_request({
        method: "PUT",
        path: "/fallback/" + name,
        query: {
          sources: sources,
          options: options
        }
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Fallback;

  }).call(this);

  module.exports.Metadata = {};

  module.exports.Metadata.Get = (function() {
    var _this = this;

    __extends(Get, Source);

    function Get() {
      this.get_metadata = __bind(this.get_metadata, this);
      Get.__super__.constructor.apply(this, arguments);
    }

    Get.create = function(source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(Get, source);
      return res.http_request({
        method: "PUT",
        path: "/get_metadata/" + source.name
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    Get.prototype.get_metadata = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/sources/" + this.name + "/metadata"
      }, fn);
    };

    return Get;

  }).call(this);

  module.exports.Metadata.Set = (function() {
    var _this = this;

    __extends(Set, Source);

    function Set() {
      this.set_metadata = __bind(this.set_metadata, this);
      Set.__super__.constructor.apply(this, arguments);
    }

    Set.create = function(source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(Set, source);
      return res.http_request({
        method: "PUT",
        path: "/set_metadata/" + source.name
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    Set.prototype.set_metadata = function(metadata, fn) {
      return this.http_request({
        method: "POST",
        path: "/sources/" + this.name + "/metadata",
        query: metadata
      }, fn);
    };

    return Set;

  }).call(this);

  Stateful = (function() {

    function Stateful() {}

    Stateful.start = function(fn) {
      return this.http_request({
        method: "POST",
        path: "/sources/" + this.name + "/start"
      }, fn);
    };

    Stateful.stop = function(fn) {
      return this.http_request({
        method: "POST",
        path: "/sources/" + this.name + "/stop"
      }, fn);
    };

    Stateful.status = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/sources/" + this.name + "/status"
      }, fn);
    };

    return Stateful;

  })();

  module.exports.Output = {};

  module.exports.Output.Ao = (function() {
    var _this = this;

    __extends(Ao, Source);

    function Ao() {
      Ao.__super__.constructor.apply(this, arguments);
    }

    Ao.create = function(source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(Ao, source);
      mixin(Stateful, res);
      return res.http_request({
        method: "PUT",
        path: "/output/ao/" + source.name
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Ao;

  }).call(this);

  module.exports.Output.Dummy = (function() {
    var _this = this;

    __extends(Dummy, Source);

    function Dummy() {
      Dummy.__super__.constructor.apply(this, arguments);
    }

    Dummy.create = function(source, opts, fn) {
      var res;
      if (fn == null) {
        fn = opts;
        opts = {};
      }
      res = Source.create(Dummy, source);
      mixin(Stateful, res);
      return res.http_request({
        method: "PUT",
        path: "/output/dummy/" + source.name
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    return Dummy;

  }).call(this);

}).call(this);

});

require.define("/utils.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var fromByteArray;

  fromByteArray = require("base64-js").fromByteArray;

  module.exports.chain = function(object, process, fn) {
    var exec, key, keys, value;
    if (object == null) return fn(null);
    keys = (function() {
      var _results;
      _results = [];
      for (key in object) {
        value = object[key];
        _results.push(key);
      }
      return _results;
    })();
    exec = function() {
      if (!(keys.length > 0)) return fn(null);
      key = keys.shift();
      return process(object[key], key, function(err) {
        if (err != null) return fn(err);
        return exec();
      });
    };
    return exec();
  };

  module.exports.stringify = function(object) {
    var key, res, value;
    res = {};
    for (key in object) {
      value = object[key];
      res[key] = "" + value;
    }
    return res;
  };

  module.exports.mixin = function(src, dst) {
    var label, value, _results;
    _results = [];
    for (label in src) {
      value = src[label];
      if (dst[label] == null) {
        _results.push(dst[label] = value);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  module.exports.b64 = function(str) {
    return fromByteArray(Array.prototype.map.call(str, function(char) {
      return char.charCodeAt(0);
    }));
  };

}).call(this);

});

require.define("/node_modules/base64-js/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"lib/b64.js"}
});

require.define("/node_modules/base64-js/lib/b64.js", function (require, module, exports, __dirname, __filename) {
(function (exports) {
	'use strict';

	var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	function b64ToByteArray(b64) {
		var i, j, l, tmp, placeHolders, arr;
	
		if (b64.length % 4 > 0) {
			throw 'Invalid string. Length must be a multiple of 4';
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		placeHolders = b64.indexOf('=');
		placeHolders = placeHolders > 0 ? b64.length - placeHolders : 0;

		// base64 is 4/3 + up to two characters of the original data
		arr = [];//new Uint8Array(b64.length * 3 / 4 - placeHolders);

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length;

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (lookup.indexOf(b64[i]) << 18) | (lookup.indexOf(b64[i + 1]) << 12) | (lookup.indexOf(b64[i + 2]) << 6) | lookup.indexOf(b64[i + 3]);
			arr.push((tmp & 0xFF0000) >> 16);
			arr.push((tmp & 0xFF00) >> 8);
			arr.push(tmp & 0xFF);
		}

		if (placeHolders === 2) {
			tmp = (lookup.indexOf(b64[i]) << 2) | (lookup.indexOf(b64[i + 1]) >> 4);
			arr.push(tmp & 0xFF);
		} else if (placeHolders === 1) {
			tmp = (lookup.indexOf(b64[i]) << 10) | (lookup.indexOf(b64[i + 1]) << 4) | (lookup.indexOf(b64[i + 2]) >> 2);
			arr.push((tmp >> 8) & 0xFF);
			arr.push(tmp & 0xFF);
		}

		return arr;
	}

	function uint8ToBase64(uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length;

		function tripletToBase64 (num) {
			return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
		};

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
			output += tripletToBase64(temp);
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1];
				output += lookup[temp >> 2];
				output += lookup[(temp << 4) & 0x3F];
				output += '==';
				break;
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1]);
				output += lookup[temp >> 10];
				output += lookup[(temp >> 4) & 0x3F];
				output += lookup[(temp << 2) & 0x3F];
				output += '=';
				break;
		}

		return output;
	}

	module.exports.toByteArray = b64ToByteArray;
	module.exports.fromByteArray = uint8ToBase64;
}());

});

require.define("http", function (require, module, exports, __dirname, __filename) {
module.exports = require("http-browserify")
});

require.define("/node_modules/http-browserify/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"index.js","browserify":"index.js"}
});

require.define("/node_modules/http-browserify/index.js", function (require, module, exports, __dirname, __filename) {
var http = module.exports;
var EventEmitter = require('events').EventEmitter;
var Request = require('./lib/request');

http.request = function (params, cb) {
    if (!params) params = {};
    if (!params.host) params.host = window.location.host.split(':')[0];
    if (!params.port) params.port = window.location.port;
    
    var req = new Request(new xhrHttp, params);
    if (cb) req.on('response', cb);
    return req;
};

http.get = function (params, cb) {
    params.method = 'GET';
    var req = http.request(params, cb);
    req.end();
    return req;
};

http.Agent = function () {};
http.Agent.defaultMaxSockets = 4;

var xhrHttp = (function () {
    if (typeof window === 'undefined') {
        throw new Error('no window object present');
    }
    else if (window.XMLHttpRequest) {
        return window.XMLHttpRequest;
    }
    else if (window.ActiveXObject) {
        var axs = [
            'Msxml2.XMLHTTP.6.0',
            'Msxml2.XMLHTTP.3.0',
            'Microsoft.XMLHTTP'
        ];
        for (var i = 0; i < axs.length; i++) {
            try {
                var ax = new(window.ActiveXObject)(axs[i]);
                return function () {
                    if (ax) {
                        var ax_ = ax;
                        ax = null;
                        return ax_;
                    }
                    else {
                        return new(window.ActiveXObject)(axs[i]);
                    }
                };
            }
            catch (e) {}
        }
        throw new Error('ajax not supported in this browser')
    }
    else {
        throw new Error('ajax not supported in this browser');
    }
})();

});

require.define("/node_modules/http-browserify/lib/request.js", function (require, module, exports, __dirname, __filename) {
var EventEmitter = require('events').EventEmitter;
var Response = require('./response');

var Request = module.exports = function (xhr, params) {
    var self = this;
    self.xhr = xhr;
    self.body = '';
    
    var uri = params.host + ':' + params.port + (params.path || '/');
    
    xhr.open(
        params.method || 'GET',
        (params.scheme || 'http') + '://' + uri,
        true
    );
    
    if (params.headers) {
        Object.keys(params.headers).forEach(function (key) {
            if (!self.isSafeRequestHeader(key)) return;
            var value = params.headers[key];
            if (Array.isArray(value)) {
                value.forEach(function (v) {
                    xhr.setRequestHeader(key, v);
                });
            }
            else xhr.setRequestHeader(key, value)
        });
    }
    
    var res = new Response;
    res.on('ready', function () {
        self.emit('response', res);
    });
    
    xhr.onreadystatechange = function () {
        res.handle(xhr);
    };
};

Request.prototype = new EventEmitter;

Request.prototype.setHeader = function (key, value) {
    if ((Array.isArray && Array.isArray(value))
    || value instanceof Array) {
        for (var i = 0; i < value.length; i++) {
            this.xhr.setRequestHeader(key, value[i]);
        }
    }
    else {
        this.xhr.setRequestHeader(key, value);
    }
};

Request.prototype.write = function (s) {
    this.body += s;
};

Request.prototype.end = function (s) {
    if (s !== undefined) this.write(s);
    this.xhr.send(this.body);
};

// Taken from http://dxr.mozilla.org/mozilla/mozilla-central/content/base/src/nsXMLHttpRequest.cpp.html
Request.unsafeHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "content-transfer-encoding",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via"
];

Request.prototype.isSafeRequestHeader = function (headerName) {
    if (!headerName) return false;
    return (Request.unsafeHeaders.indexOf(headerName.toLowerCase()) === -1)
};

});

require.define("/node_modules/http-browserify/lib/response.js", function (require, module, exports, __dirname, __filename) {
var EventEmitter = require('events').EventEmitter;

var Response = module.exports = function (res) {
    this.offset = 0;
};

Response.prototype = new EventEmitter;

var capable = {
    streaming : true,
    status2 : true
};

function parseHeaders (res) {
    var lines = res.getAllResponseHeaders().split(/\r?\n/);
    var headers = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line === '') continue;
        
        var m = line.match(/^([^:]+):\s*(.*)/);
        if (m) {
            var key = m[1].toLowerCase(), value = m[2];
            
            if (headers[key] !== undefined) {
                if ((Array.isArray && Array.isArray(headers[key]))
                || headers[key] instanceof Array) {
                    headers[key].push(value);
                }
                else {
                    headers[key] = [ headers[key], value ];
                }
            }
            else {
                headers[key] = value;
            }
        }
        else {
            headers[line] = true;
        }
    }
    return headers;
}

Response.prototype.getHeader = function (key) {
    return this.headers[key.toLowerCase()];
};

Response.prototype.handle = function (res) {
    if (res.readyState === 2 && capable.status2) {
        try {
            this.statusCode = res.status;
            this.headers = parseHeaders(res);
        }
        catch (err) {
            capable.status2 = false;
        }
        
        if (capable.status2) {
            this.emit('ready');
        }
    }
    else if (capable.streaming && res.readyState === 3) {
        try {
            if (!this.statusCode) {
                this.statusCode = res.status;
                this.headers = parseHeaders(res);
                this.emit('ready');
            }
        }
        catch (err) {}
        
        try {
            this.write(res);
        }
        catch (err) {
            capable.streaming = false;
        }
    }
    else if (res.readyState === 4) {
        if (!this.statusCode) {
            this.statusCode = res.status;
            this.emit('ready');
        }
        this.write(res);
        
        if (res.error) {
            this.emit('error', res.responseText);
        }
        else this.emit('end');
    }
};

Response.prototype.write = function (res) {
    if (res.responseText.length > this.offset) {
        this.emit('data', res.responseText.slice(this.offset));
        this.offset = res.responseText.length;
    }
};

});

require.define("https", function (require, module, exports, __dirname, __filename) {
module.exports = require('http');

});

require.define("/wrapper.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var util;

  window.console || (window.console = {});

  window.console.log = function(val) {
    return $("#foo").append("" + val + "<br/>");
  };

  util = require("util");

  window.console.dir = function(val) {
    return console.log(util.inspect(val));
  };

  $(function() {
    console.log("starting!");
    return require("./request");
  });

}).call(this);

});
require("/wrapper.coffee");
