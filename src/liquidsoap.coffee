{chain} = require "./utils"

class module.exports.Client
  constructor: (@opts) ->
    @auth = new Buffer("#{opts.auth}").toString "base64" if opts.auth?
    @host = opts.host
    @http = require(opts.scheme || "http")
    @port = opts.port || 80

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

    for label, value of src
      res[label] = value unless res[label]?

    res

class module.exports.Blank extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn       = opts
      opts     = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   : "/blank/#{name}",
      query  : opts.duration || 0 }, (err) ->
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
      path   : "/requests/#{@name}",
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
      path   :   "/get_metadata/#{name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  get_metadata: (fn) =>
    @http_request {
      method : "GET",
      path   : "/metadata/#{@name}" }, fn

class module.exports.Metadata.Set extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    res.http_request {
      method : "PUT",
      path   :   "/set_metadata/#{name}"}, (err) ->
        return fn err, null if err?

        fn null, res

  set_metadata: (metadata, fn) =>
    @http_request {
      method : "POST",
      path   : "/metadata/#{@name}",
      query  : metadata }, fn

module.exports.Output = {}

class module.exports.Output.Ao extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    res.http_request {
      method: "PUT",
      path:   "/output/ao/#{name}"}, (err) ->
        return fn err, null if err?

        fn null, res

class module.exports.Output.Dummy extends Source
  @create: (name, source, opts, fn) =>
    unless fn?
      fn   = opts
      opts = {}

    res = Source.create name, this, source

    res.http_request {
      method: "PUT",
      path:   "/output/dummy/#{name}"}, (err) ->
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
