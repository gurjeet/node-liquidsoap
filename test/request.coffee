{Client, Request,
 Mksafe, Output,
 Metadata }        = require "../src/liquidsoap"

opts =
  auth: "test:test"
  name: "foo"
  host: "localhost"
  port: 8080

client = new Client opts

Request.Queue.create client, (err, source) ->
  return console.log "Error creating request source." if err?

  Metadata.Set.create source, (err, source) ->
    return console.log "Error while enabling set metadata." if err?

    Metadata.Get.create source, (err, source) ->
      return console.log "Error enabling get metadata." if err?

      Mksafe.create source, (err, source) ->
        return console.log "Error creating mksafe source." if err?

        Output.Ao.create source, (err, source) ->
          return console.log "Error creating ao source." if err?

          source.push "/tmp/bla.mp3", (err) ->
            return console.log "Error pushing request to request source" if err?

            set_meta = (next) ->
              console.log "Setting artist to \"foo bar lol\""

              source.set_metadata artist: "foo bar lol", (err) ->
                return "Error setting metadata." if err?

                setTimeout next, 500 if next?

            get_meta = (next) ->
              source.get_metadata (err, res) ->
                return console.log "Error grabbing metadata" if err?
  
                console.log """
                    Latest metadata: 
                    #{JSON.stringify res, undefined, 2}
                            """
  
                setTimeout next, 500 if next?

            fn = ->
              get_meta ->
                set_meta ->
                  get_meta ->
                    console.log "All Good Folks!"

            setTimeout fn, 500

