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
      this.scheme = opts.scheme || "http";
      if (opts.scheme === "https") {
        this.http = require("https");
      } else {
        this.http = require("http");
      }
      this.port = opts.port || 80;
    }

    Client.prototype.http_request = function(opts, fn) {
      var expects, headers, options, query, req;
      expects = opts.expects || 200;
      query = opts.query;
      options = opts.options || {};
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
        headers: headers,
        scheme: this.scheme
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
              options: opts,
              query: query,
              response: data
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
            var callback, source, _ref2;
            if (err != null) return fn(err);
            if (params.name != null) {
              name = params.name;
            } else {
              params.name = name;
            }
            if (((_ref2 = params.source) != null ? _ref2.name : void 0) != null) {
              source = res[params.source.name];
            } else {
              source = res[name];
            }
            source = source || _this;
            callback = function(err, source) {
              if (err != null) return fn(err);
              res[name] = source;
              return fn(null, name);
            };
            return params.type.create(source, params, callback);
          });
        });
      };
      return chain(sources, exec, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    Client.prototype.sources = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/sources"
      }, fn);
    };

    return Client;

  })();

  Source = (function() {

    Source.create = function(client, opts, fn) {
      var res, _ref2;
      res = new this(client, opts);
      delete opts.type;
      if (opts.sources == null) {
        if (((_ref2 = opts.source) != null ? _ref2.name : void 0) != null) {
          opts.source = opts.source.name;
        } else if (client.name != null) {
          opts.source = client.name;
        } else {
          delete opts.source;
        }
      }
      return res.http_request({
        method: "POST",
        path: this.path,
        query: stringify(opts),
        expects: 201
      }, function(err) {
        if (err != null) return fn(err, null);
        return fn(null, res);
      });
    };

    function Source(src, opts) {
      if (opts.sources != null) {
        this.name = opts.options.name;
      } else {
        this.name = opts.name || (opts.name = src.name);
      }
      mixin(src, this);
      delete this.sources;
      this;
    }

    Source.prototype.skip = function(fn) {
      return this.http_request({
        method: "PUT",
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

    __extends(Blank, Source);

    function Blank() {
      Blank.__super__.constructor.apply(this, arguments);
    }

    Blank.path = "/blank";

    return Blank;

  })();

  module.exports.Single = (function() {

    __extends(Single, Source);

    function Single() {
      Single.__super__.constructor.apply(this, arguments);
    }

    Single.path = "/single";

    return Single;

  })();

  module.exports.Request = {};

  module.exports.Request.Queue = (function() {

    __extends(Queue, Source);

    function Queue() {
      this.push = __bind(this.push, this);
      Queue.__super__.constructor.apply(this, arguments);
    }

    Queue.path = "/request/queue";

    Queue.prototype.push = function(requests, fn) {
      if (!(requests instanceof Array)) requests = [requests];
      return this.http_request({
        method: "PUT",
        path: "/sources/" + this.name + "/requests",
        query: requests
      }, fn);
    };

    return Queue;

  })();

  module.exports.Request.Dynamic = (function() {

    __extends(Dynamic, Source);

    function Dynamic() {
      Dynamic.__super__.constructor.apply(this, arguments);
    }

    Dynamic.path = "/request/dynamic";

    return Dynamic;

  })();

  module.exports.Fallback = (function() {

    __extends(Fallback, Source);

    function Fallback() {
      Fallback.__super__.constructor.apply(this, arguments);
    }

    Fallback.path = "/fallback";

    Fallback.create = function(client, opts, fn) {
      var key, options, source, sources, _ref2;
      sources = {};
      _ref2 = opts.sources;
      for (key in _ref2) {
        source = _ref2[key];
        sources[key] = "";
      }
      options = opts.options || {};
      options.name = opts.name;
      return Fallback.__super__.constructor.create.call(this, client, {
        sources: sources,
        options: options
      }, fn);
    };

    return Fallback;

  })();

  module.exports.Metadata = {};

  module.exports.Metadata.Get = (function() {

    __extends(Get, Source);

    function Get() {
      this.get_metadata = __bind(this.get_metadata, this);
      Get.__super__.constructor.apply(this, arguments);
    }

    Get.path = "/get_metadata";

    Get.prototype.get_metadata = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/sources/" + this.name + "/metadata"
      }, fn);
    };

    return Get;

  })();

  module.exports.Metadata.Set = (function() {

    __extends(Set, Source);

    function Set() {
      this.set_metadata = __bind(this.set_metadata, this);
      Set.__super__.constructor.apply(this, arguments);
    }

    Set.path = "/set_metadata";

    Set.prototype.set_metadata = function(metadata, fn) {
      return this.http_request({
        method: "PUT",
        path: "/sources/" + this.name + "/metadata",
        query: metadata
      }, fn);
    };

    return Set;

  })();

  Stateful = (function() {

    __extends(Stateful, Source);

    function Stateful() {
      Stateful.__super__.constructor.apply(this, arguments);
    }

    Stateful.prototype.start = function(fn) {
      return this.http_request({
        method: "PUT",
        path: "/sources/" + this.name + "/start"
      }, fn);
    };

    Stateful.prototype.stop = function(fn) {
      return this.http_request({
        method: "PUT",
        path: "/sources/" + this.name + "/stop"
      }, fn);
    };

    Stateful.prototype.status = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/sources/" + this.name + "/status"
      }, fn);
    };

    return Stateful;

  })();

  module.exports.Input = {};

  module.exports.Input.Http = (function() {

    __extends(Http, Stateful);

    function Http() {
      Http.__super__.constructor.apply(this, arguments);
    }

    Http.path = "/input/http";

    return Http;

  })();

  module.exports.Output = {};

  module.exports.Output.Ao = (function() {

    __extends(Ao, Stateful);

    function Ao() {
      Ao.__super__.constructor.apply(this, arguments);
    }

    Ao.path = "/output/ao";

    return Ao;

  })();

  module.exports.Output.Dummy = (function() {

    __extends(Dummy, Stateful);

    function Dummy() {
      Dummy.__super__.constructor.apply(this, arguments);
    }

    Dummy.path = "/output/dummy";

    return Dummy;

  })();

}).call(this);

});

require.define("/utils.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var fromByteArray, stringify;

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

  module.exports.stringify = stringify = function(object) {
    var key, res, value;
    res = {};
    for (key in object) {
      value = object[key];
      if (typeof value === "object") {
        res[key] = stringify(value);
      } else {
        res[key] = "" + value;
      }
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
    return fromByteArray(Array.prototype.map.call(str, function(ch) {
      return ch.charCodeAt(0);
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

require.define("https", function (require, module, exports, __dirname, __filename) {
module.exports = require('http');

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

require.define("/entry.coffee", function (require, module, exports, __dirname, __filename) {
    
  window.liquidsoap = require("./liquidsoap");

});
require("/entry.coffee");
