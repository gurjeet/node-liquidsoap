(function() {
  var Source;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  module.exports.Client = (function() {
    function Client(opts) {
      this.opts = opts;
      this.http_request = __bind(this.http_request, this);
      if (opts.auth != null) {
        this.auth = new Buffer("" + opts.auth).toString("base64");
      }
      this.host = opts.host;
      this.http = require(opts.scheme || "http");
      this.port = opts.port || 80;
      this.name = opts.name;
    }
    Client.prototype.http_request = function(opts, fn) {
      var expects, headers, query, req;
      expects = opts.expects || 200;
      query = opts.query;
      headers = {
        "Accept": "application/json"
      };
      if (this.auth != null) {
        headers["Authorization"] = "Basic " + this.auth;
      }
      opts = {
        hostname: this.host,
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
        if (res.statusCode !== expects) {
          return fn(res, null);
        }
        data = "";
        res.on("data", function(buf) {
          return data += buf;
        });
        return res.on("end", function() {
          try {
            data = JSON.parse(data);
          } catch (err) {

          }
          return fn(null, data);
        });
      });
      return req.end(query);
    };
    return Client;
  })();
  Source = (function() {
    function Source() {}
    Source.create = function(dst, src) {
      var label, res, value;
      res = new dst(src.opts);
      for (label in src) {
        value = src[label];
        if (res[label] == null) {
          res[label] = value;
        }
      }
      return res;
    };
    return Source;
  })();
  module.exports.Request = {};
  module.exports.Request.Queue = (function() {
    __extends(Queue, Source);
    function Queue() {
      this.push = __bind(this.push, this);
      this.Queue = __bind(this.Queue, this);
      Queue.__super__.constructor.apply(this, arguments);
    }
    Queue.create = function(opts, fn) {
      var res;
      res = Source.create(this, opts);
      return res.http_request({
        method: "PUT",
        path: "/request/queue/" + res.name
      }, function(err) {
        if (err != null) {
          return fn(err, null);
        }
        return fn(null, res);
      });
    };
    Queue.prototype.push = function(requests, fn) {
      if (!(requests instanceof Array)) {
        requests = [requests];
      }
      return this.http_request({
        method: "POST",
        path: "/requests/" + this.name,
        query: requests
      }, fn);
    };
    return Queue;
  })();
  module.exports.Metadata = {};
  module.exports.Metadata.Get = (function() {
    __extends(Get, Source);
    function Get() {
      this.get_metadata = __bind(this.get_metadata, this);
      this.Get = __bind(this.Get, this);
      Get.__super__.constructor.apply(this, arguments);
    }
    Get.create = function(opts, fn) {
      var res;
      res = Source.create(this, opts);
      return res.http_request({
        method: "PUT",
        path: "/get_metadata/" + res.name
      }, function(err) {
        if (err != null) {
          return fn(err, null);
        }
        return fn(null, res);
      });
    };
    Get.prototype.get_metadata = function(fn) {
      return this.http_request({
        method: "GET",
        path: "/metadata/" + this.name
      }, fn);
    };
    return Get;
  })();
  module.exports.Output = {};
  module.exports.Output.Ao = (function() {
    __extends(Ao, Source);
    function Ao() {
      this.Ao = __bind(this.Ao, this);
      Ao.__super__.constructor.apply(this, arguments);
    }
    Ao.create = function(source, fn) {
      var res;
      res = Source.create(this, source);
      return res.http_request({
        method: "PUT",
        path: "/output/ao/" + source.name
      }, function(err) {
        if (err != null) {
          return fn(err, null);
        }
        return fn(null, res);
      });
    };
    return Ao;
  })();
  module.exports.Mksafe = (function() {
    __extends(Mksafe, Source);
    function Mksafe() {
      this.Mksafe = __bind(this.Mksafe, this);
      Mksafe.__super__.constructor.apply(this, arguments);
    }
    Mksafe.create = function(source, fn) {
      var res;
      res = Source.create(this, source);
      return res.http_request({
        method: "PUT",
        path: "/mksafe/" + source.name
      }, function(err) {
        if (err != null) {
          return fn(err, null);
        }
        return fn(null, res);
      });
    };
    return Mksafe;
  })();
}).call(this);
