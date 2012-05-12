{fromByteArray} = require "base64-js"

module.exports.chain = (object, process, fn) ->
  return fn null unless object?

  keys = (key for key, value of object)

  exec = ->
    return fn null unless keys.length > 0

    key = keys.shift()

    process object[key], key, (err) ->
      return fn err if err?

      exec()

  exec()

module.exports.stringify = stringify = (object) ->
  res = {}

  for key, value of object
    if typeof value == "object"
      res[key] = stringify(value)
    else
      res[key] = "#{value}"

  res

module.exports.mixin = (src, dst) ->
  for label, value of src
    dst[label] = value unless dst[label]?

# For the browser..
module.exports.b64 = (str) ->
  fromByteArray Array.prototype.map.call(str, (char) -> char.charCodeAt(0))
