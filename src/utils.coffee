
module.exports.chain = (object, process, fn) ->
  return fn null unless object?

  keys = (key for key, value of object)

  exec = ->
    return fn null unless keys.length > 0

    key = keys.pop()

    process object[key], key, (err) ->
      return fn err if err?

      exec()

  exec()

