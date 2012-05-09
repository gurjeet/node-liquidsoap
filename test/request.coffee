{ Client,   Request,
  Output,   Input,
  Metadata, Fallback,
  Single,   Blank } = require "./liquidsoap"

opts =
  auth: "test:test"
  host: "localhost"
  port: 8080

client = new Client opts

sources =
  foo :
    type   : Output.Ao
    source :
      type   : Metadata.Get
      source :
        type   : Metadata.Set
        source :
          type    : Fallback
          name    : "fallback"
          sources :
            request1 :
              type : Request.Queue
            request2 :
              type : Request.Queue
            radiopi  :
              type      : Input.Http
              uri       : "http://radiopi.org:8080/reggae"
              autostart : false
  bar :
    type     : Blank
    duration : 3
  bla :
    type : Single
    uri  : "say:it works!"

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

checkState = (source, fn) ->
  source.status (err, res) ->
    return fn err if err?

    console.log "Current status for #{source.name}:"
    console.dir res

    source.start (err) ->
      return fn err if err?

      source.status (err, res) ->
        console.log "New status for #{source.name}:"
        console.dir res

        fn null

client.create sources, (err, sources) ->
  if err?
    console.log "Error while creating sources:"
    return console.dir err

  # Test case where source is already instanciated
  dummy =
    dummy :
      type   : Output.Dummy
      source : sources.bar

  client.create dummy, (err) ->
    if err?
      console.log "Error while creating dummy source."
      return console.dir err

  if err?
    console.log "Error while creating sources:"
    return console.dir err

  pushRequest sources.request1, "/tmp/foo.mp3", ->
    pushRequest sources.request2, "/tmp/bla.mp3", ->
      changeMetadata sources.foo, "foo", ->
        sources.request1.skip (err) ->
          if err?
            console.log "Error while skipping on request1:"
            return console.dir err

          sources.bar.shutdown (err) ->
            if err?
              console.log "Error while shutting bar (dummy) source down:"
              return console.dir err

            checkState sources.radiopi, (err) ->
              if err?
                console.log "Error while checking radiopi's status:"
                console.dir err

              cb = ->
                sources.fallback.skip (err) ->
                  if err?
                    console.log "Error while skipping on fallback:"
                    return console.dir err

                  console.log "All Good Folks!"
             
              setTimeout cb, 1000
