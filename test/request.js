liquidsoap = require("../lib/liquidsoap.js");

opts = {
  auth: "test:test",
  name: "foo",
  host: "localhost",
  port: 8080 }


liquidsoap.Request.Queue.create(opts, function(err, source) {
  if (err)
    return console.log("Error creating request source.");
  
  liquidsoap.Mksafe.create(source, function(err, source) {
    if (err)
      return console.log("Error creating mksafe source.");

    liquidsoap.Output.Ao.create(source, function(err, source) {
      if (err)
        console.log("Error creating ao source.");

      source.push("/tmp/bla.mp3", function (err) {
         if (err)
           console.log("Error pushing request to request source");

         return console.log("All good folks!");
      });
    });
  });
});
