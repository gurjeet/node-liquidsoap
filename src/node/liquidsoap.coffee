{b64, chain, stringify, mixin} = require "./utils"

class module.exports.Client
  constructor: (@opts) ->
    @auth = opts.auth
    @host = opts.host
    # For browserify..
    if opts.scheme == "http"
      @http = require "http"
    else
      @http = require "https"
    @port = opts.port || 80

  http_request: (opts, fn) =>
    expects = opts.expects || 200
    query   = opts.query

    headers =
      "Accept" : "application/json"

    if @auth?
      headers["Authorization"] = "Basic #{b64 @auth}"

    opts =
      host    : @host
      port    : @port
      method  : opts.method
      path    : opts.path
      headers : headers

    if query?
      query = JSON.stringify query

      opts.headers["Content-Type"]   = "application/json"
      opts.headers["Content-Length"] = query.length

    req = @http.request opts, (res) ->
      data = ""
      res.on "data", (buf) -> data += buf
      res.on "end", ->
        try
          data = JSON.parse data
        catch err

        if res.statusCode != expects
          err =
            code    : res.statusCode
            data    : data
            options : opts

          return fn err, null

        fn null, data

    req.end query

  create: (sources, fn) ->
    res = {}

    # Exec params, name create source name
    # with given param, ppossibly recursing
    # down to params.source and params.sources
    # if they exist.
    exec = (params, name, fn) =>
      return fn null unless params?

      unless params.type?
        res[name] = params
        return fn null

      chain params.sources, exec, (err) =>
        return fn err if err?

        exec params.source, name, (err) =>
          return fn err if err?
       
          # If source does not exist yet (source creation,
          # e.g request.queue etc..), then use current client.
          source  = res[name] || this

          params.type.create name, source, params, (err, source) =>
            return fn err if err?

            res[name] = source
            fn null

    # Create all top-level sources
    chain sources, exec, (err) ->
      return fn err, null if err?

      fn null, res

class Source
  @create: (name, dst, src) ->
    res = new dst
    res.name = name
    mixin src, res
    res

  # Generic endpoints
  skip: (fn) ->
    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/skip"}, fn

  shutdown: (fn) ->
    @http_request {
      method : "DELETE",
      path   : "/sources/#{@name}"}, fn

class module.exports.Blank extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn       = opts
      opts     = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   : "/blank/#{res.name}",
      query  : opts.duration || 0 }, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Single extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn       = opts
      opts     = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   : "/single/#{res.name}",
      query  : opts.uri || 0 }, (err) ->
        return fn err, null if err?

        fn null, res

module.exports.Input = {}

class module.exports.Input.Http extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn       = opts
      opts     = {}
  
    res = Source.create name, this, source
     
    mixin Stateful, res

    res.http_request {
      method : "PUT",
      path   : "/input/http/#{res.name}",
      query  : stringify(opts) }, (err) ->
        return fn err, null if err?

        fn null, res

module.exports.Request = {}

class module.exports.Request.Queue extends Source
  @create: (name, client, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, client

    res.http_request {
      method : "PUT",
      path   :   "/request/queue/#{res.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  push: (requests, fn) =>
    requests = [requests] unless requests instanceof Array

    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/requests",
      query  : requests }, fn

module.exports.Metadata = {}

class module.exports.Metadata.Get extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   :   "/get_metadata/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  get_metadata: (fn) =>
    @http_request {
      method : "GET",
      path   : "/sources/#{@name}/metadata" }, fn

class module.exports.Metadata.Set extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   :   "/set_metadata/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  set_metadata: (metadata, fn) =>
    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/metadata",
      query  : metadata }, fn

class Stateful
  @start: (fn) ->
    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/start" }, fn

  @stop: (fn) ->
    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/stop" }, fn

  @status: (fn) ->
    @http_request {
      method : "GET",
      path   : "/sources/#{@name}/status" }, fn

module.exports.Output = {}

class module.exports.Output.Ao extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    mixin Stateful, res

    res.http_request {
      method: "PUT",
      path:   "/output/ao/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Output.Dummy extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    mixin Stateful, res

    res.http_request {
      method: "PUT",
      path:   "/output/dummy/#{source.name}"}, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Fallback extends Source
  @create: (name, client, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res     = Source.create name, this, client
    sources = (key for key, source of opts.sources)

    options = opts.options || []

    res.http_request {
      method : "PUT",
      path   : "/fallback/#{name}",
      query  : 
        sources : sources
        options : options }, (err) ->
        return fn err, null if err?

        fn null, res
