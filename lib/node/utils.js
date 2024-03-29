// Generated by CoffeeScript 1.3.1
(function() {
  var fromByteArray, stringify;

  fromByteArray = require("base64-js").fromByteArray;

  module.exports.chain = function(object, process, fn) {
    var exec, key, keys, value;
    if (object == null) {
      return fn(null);
    }
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
      if (!(keys.length > 0)) {
        return fn(null);
      }
      key = keys.shift();
      return process(object[key], key, function(err) {
        if (err != null) {
          return fn(err);
        }
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
