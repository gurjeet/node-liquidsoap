task 'build', 'Compile coffee scripts into plain Javascript files', ->
  child = require("child_process").exec "coffee -c -o lib src/*.coffee", (err, stdout, stderr) ->
    if err?
      console.error "Error :"
      console.dir   err
      console.log stdout
      console.error stderr
    else
      console.log "Done!"

task 'test', 'Run the tests', (args) ->
  require "./test/request"
