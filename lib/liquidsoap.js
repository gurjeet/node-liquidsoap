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
  Source = (function() {
    function Source(opts) {
      this.http_request = __bind(this.http_request, this);      if (opts.auth != null) {
        this.auth = new Buffer("" + opts.auth).toString("base64");
      }
      this.host = opts.host;
      this.http = require(opts.scheme || "http");
      this.port = opts.port || 80;
      this.name = opts.name;
    }
    Source.prototype.http_request = function(opts, fn) {
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
    return Source;
  })();
  module.exports.RequestQueue = (function() {
    __extends(RequestQueue, Source);
    function RequestQueue() {
      this.push = __bind(this.push, this);
      this.enable = __bind(this.enable, this);
      RequestQueue.__super__.constructor.apply(this, arguments);
    }
    RequestQueue.prototype.enable = function(fn) {
      return this.http_request({
        method: "PUT",
        path: "/request/queue/" + this.name
      }, fn);
    };
    RequestQueue.prototype.push = function(requests, fn) {
      if (!(requests instanceof Array)) {
        requests = [requests];
      }
      return this.http_request({
        method: "POST",
        path: "/requests/" + this.name,
        query: requests
      }, fn);
    };
    return RequestQueue;
  })();
  module.exports.OutputAo = (function() {
    __extends(OutputAo, Source);
    function OutputAo() {
      this.enable = __bind(this.enable, this);
      OutputAo.__super__.constructor.apply(this, arguments);
    }
    OutputAo.prototype.enable = function(source, fn) {
      return this.http_request({
        method: "PUT",
        path: "/output/ao/" + source.name
      }, fn);
    };
    return OutputAo;
  })();
  module.exports.Mksafe = (function() {
    __extends(Mksafe, Source);
    function Mksafe() {
      this.enable = __bind(this.enable, this);
      Mksafe.__super__.constructor.apply(this, arguments);
    }
    Mksafe.prototype.enable = function(source, fn) {
      return this.http_request({
        method: "PUT",
        path: "/mksafe/" + source.name
      }, fn);
    };
    return Mksafe;
  })();
}).call(this);
