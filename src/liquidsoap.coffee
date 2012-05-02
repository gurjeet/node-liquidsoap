class Source
  constructor: (opts) ->
    @auth = new Buffer("#{opts.auth}").toString "base64" if opts.auth?
    @host = opts.host
    @http = require(opts.scheme || "http")
    @port = opts.port || 80
    @name = opts.name

  http_request: (opts, fn) =>
    expects = opts.expects || 200
    query   = opts.query

    headers =
      "Accept" : "application/json"

    headers["Authorization"] = "Basic #{@auth}" if @auth?

    opts =
      hostname : @host
      port     : @port
      method   : opts.method
      path     : opts.path
      headers  : headers

    if query?
      query = JSON.stringify query

      opts.headers["Content-Type"]   = "application/json"
      opts.headers["Content-Length"] = query.length

    req = @http.request opts, (res) ->
      return fn res, null unless res.statusCode == expects

      data = ""
      res.on "data", (buf) -> data += buf
      res.on "end", ->
        try
          data = JSON.parse data
        catch err

        fn null, data

    req.end query

class module.exports.RequestQueue extends Source
  enable: (fn) =>
    @http_request {
      method : "PUT",
      path   :   "/request/queue/#{@name}"}, fn

  push: (requests, fn) =>
    requests = [requests] unless requests instanceof Array

    @http_request {
      method : "POST",
      path   : "/requests/#{@name}",
      query  : requests }, fn

class module.exports.OutputAo extends Source
  enable: (source, fn) =>
    @http_request {
      method: "PUT",
      path:   "/output/ao/#{source.name}"}, fn

class module.exports.Mksafe extends Source
  enable: (source, fn) =>
    @http_request {
      method: "PUT",
      path:   "/mksafe/#{source.name}"}, fn
