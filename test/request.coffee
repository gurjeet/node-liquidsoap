{Client, Request, Output,
 Metadata, Fallback, Blank } = require "../src/liquidsoap"

opts =
  auth: "test:test"
  host: "localhost"
  port: 8080

client = new Client opts

sources =
  ao :
    type   : Output.Ao
    source :
      type   : Metadata.Get
      source :
        type : Metadata.Set
        source :
          type    : Fallback
          sources :
            request1 :
              type : Request.Queue
            request2 :
              type : Request.Queue
  dummy :
    type   : Output.Dummy
    source :
      type : Blank

pushRequest = (source, request, fn) ->
 source.push request, (err) ->
   return console.log "Error pushing request to request source" if err?

   fn()

changeMetadata = (source, value, fn) ->
 set_meta = (next) ->
   console.log "Setting artist to \"#{value}\" on source #{source.name}"

   source.set_metadata artist: value, (err) ->
     return "Error setting metadata." if err?

     setTimeout next, 500 if next?

  get_meta = (next) ->
    source.get_metadata (err, res) ->
      return console.log "Error grabbing metadata" if err?

      console.log """
        Latest metadata on #{source.name}: 
        #{JSON.stringify res, undefined, 2}
                  """
  
      setTimeout next, 500 if next?

  cb = ->
    get_meta ->
      set_meta ->
        get_meta ->
          fn()

  setTimeout cb, 1000

client.create sources, (err, sources) ->
  if err?
    console.log "Error while creating sources:"
    return console.dir err

  pushRequest sources.request1, "/tmp/foo.mp3", ->
    pushRequest sources.request2, "/tmp/bla.mp3", ->
      changeMetadata sources.ao, "foo", ->
        console.log "All Good Folks!"
