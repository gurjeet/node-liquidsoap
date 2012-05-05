{Client, Request,
 Mksafe, Output,
 Metadata, Fallback,
 Blank }              = require "../src/liquidsoap"

opts =
  auth: "test:test"
  name: "foo"
  host: "localhost"
  port: 8080

client = new Client opts

createSources = (fn) ->
  Request.Queue.create client, (err, source) ->
    return console.log "Error creating request source." if err?

    client.name = "bar"
    Request.Queue.create client, (err, source2) ->
      return console.log "Error creating second request source." if err?

      client.name = "blank"
      # This is not necessary but it's here to cover the API call.
      Blank.create client, (err, blank) ->
        return console.log "Error while creating blank source." if err?

        client.name = "fallback"
        Fallback.create client, [source, source2], (err, fallback) ->
          return console.log "Error while creating fallback source." if err?

          fn source, source2, fallback

addMetadata = (source, fn) ->
  Metadata.Set.create source, (err, source) ->
    return console.log "Error while enabling set metadata." if err?

    Metadata.Get.create source, (err, source) ->
      return console.log "Error enabling get metadata." if err?

      fn source

outputSource = (source, fn) ->
  # This is not necessary but it's here to cover the API call.
  Mksafe.create source, (err, source) ->
    return console.log "Error creating mksafe source." if err?

    Output.Ao.create source, (err, source) ->
      return console.log "Error creating ao source." if err?

      fn source

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

createSources (source, source2, fallback) ->

  addMetadata fallback, (fallback) ->

    outputSource fallback, ->

      pushRequest source, "/tmp/foo.mp3", ->

        pushRequest source2, "/tmp/bla.mp3", ->

          changeMetadata fallback, "foo", ->

            console.log "All Good Folks!"
