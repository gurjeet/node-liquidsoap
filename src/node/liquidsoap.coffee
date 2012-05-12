{b64, chain, stringify, mixin} = require "./utils"

class module.exports.Client
  constructor: (@opts) ->
    @auth = opts.auth
    @host = opts.host
    # For browserify..
    if opts.scheme == "https"
      @http = require "https"
    else
      @http = require "http"
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
            code     : res.statusCode
            options  : opts
            query    : query
            response : data

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

      # If no type is given, argument
      # is supposed to be already instanciated.
      unless params.type?
        res[name] = params
        return fn null

      chain params.sources, exec, (err) =>
        return fn err if err?

        exec params.source, name, (err) =>
          return fn err if err?
     
          if params.name?
            name = params.name
          else
            params.name = name

          # If params.source.name is defined,
          # pick this up for the source. Otherwise
          # use default name.
          if params.source?.name?
            source  = res[params.source.name]
          else
            source  = res[name]

          # If source does not exist yet (source creation,
          # e.g request.queue etc..), then use current client.
          source = source || this

          callback = (err, source) ->
            return fn err if err?

            res[name] = source
            fn null, name

          params.type.create source, params, callback

    # Create all top-level sources
    chain sources, exec, (err) ->
      return fn err, null if err?

      fn null, res

class Source
  @create: (dst, src, opts) ->
    res = new dst

    res.name = opts.name ||= src.name
    mixin src, res
 
    # Cleanup options
    delete opts.type

    # opts.source.
    # First, try opts.source.name if it exists
    if opts.source?.name?
      opts.source = opts.source.name
    # Then try src.name if it exists
    else if src.name?
      opts.source = src.name
    # Or else, delete it..
    else
      delete opts.source

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

# Creation operators, name in `create` params.

class module.exports.Blank extends Source
  @create: (client, opts, fn) =>
    res = Source.create this, client, opts

    res.http_request {
      method  : "PUT",
      path    : "/blank",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Single extends Source
  @create: (client, opts, fn) =>
    res = Source.create this, client, opts

    res.http_request {
      method  : "PUT",
      path    : "/single",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

module.exports.Input = {}

class module.exports.Input.Http extends Source
  @create: (client, opts, fn) =>
    res = Source.create this, client, opts
     
    mixin Stateful, res

    res.http_request {
      method  : "PUT",
      path    : "/input/http",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

module.exports.Request = {}

class module.exports.Request.Queue extends Source
  @create: (client, opts, fn) =>
    res = Source.create this, client, opts

    res.http_request {
      method  : "PUT",
      path    : "/request/queue",
      query   : stringify(opts),
      expects : 201}, (err) ->
        return fn err, null if err?

        fn null, res

  push: (requests, fn) =>
    requests = [requests] unless requests instanceof Array

    @http_request {
      method : "POST",
      path   : "/sources/#{@name}/requests",
      query  : requests }, fn

class module.exports.Request.Dynamic extends Source
  @create: (client, opts, fn) =>
    res = Source.create this, client, opts

    res.http_request {
      method  : "PUT",
      path    : "/request/dynamic",
      query   : stringify(opts),
      expects : 201}, (err) ->
        return fn err, null if err?

        fn null, res

# Fallback operator. Name in `create` params..

class module.exports.Fallback extends Source
  @create: (client, opts, fn) =>
    res     = Source.create this, client, opts
    sources = {}
    for key, source of opts.sources
      sources[key] = ""

    options      = opts.options || {}
    options.name = opts.name

    res.http_request {
      method  : "PUT",
      path    : "/fallback",
      query   :
        sources : sources
        options : options
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

# Mapping operators (no name given in `create` function parameters)

module.exports.Metadata = {}

class module.exports.Metadata.Get extends Source
  @create: (source, opts, fn) =>
    res = Source.create this, source, opts

    res.http_request {
      method  : "PUT",
      path    : "/get_metadata",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

  get_metadata: (fn) =>
    @http_request {
      method : "GET",
      path   : "/sources/#{@name}/metadata" }, fn

class module.exports.Metadata.Set extends Source
  @create: (source, opts, fn) =>
    res = Source.create this, source, opts

    res.http_request {
      method  : "PUT",
      path    : "/set_metadata",
      query   : stringify(opts),
      expects : 201 }, (err) ->
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

# Outputs (no name in `create` but may need to be reviewed
# in the future..)

module.exports.Output = {}

class module.exports.Output.Ao extends Source
  @create: (source, opts, fn) =>
    res = Source.create this, source, opts

    mixin Stateful, res

    res.http_request {
      method  : "PUT",
      path    : "/output/ao",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Output.Dummy extends Source
  @create: (source, opts, fn) =>
    res = Source.create this, source, opts

    mixin Stateful, res

    res.http_request {
      method  : "PUT",
      path    : "/output/dummy",
      query   : stringify(opts),
      expects : 201 }, (err) ->
        return fn err, null if err?

        fn null, res
