class module.exports.Client
  constructor: (@opts) ->
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

class Source
  @create: (dst, src) ->
    res = new dst src.opts

    for label, value of src
      res[label] = value unless res[label]?

    res

module.exports.Request = {}

class module.exports.Request.Queue extends Source
  @create: (opts, fn) =>
    res = Source.create this, opts

    res.http_request {
      method : "PUT",
      path   :   "/request/queue/#{res.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  push: (requests, fn) =>
    requests = [requests] unless requests instanceof Array

    @http_request {
      method : "POST",
      path   : "/requests/#{@name}",
      query  : requests }, fn

module.exports.Output = {}

class module.exports.Output.Ao extends Source
  @create: (source, fn) =>
    res = Source.create this, source

    res.http_request {
      method: "PUT",
      path:   "/output/ao/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Mksafe extends Source
  @create: (source, fn) =>
    res = Source.create this, source

    res.http_request {
      method: "PUT",
      path:   "/mksafe/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res
