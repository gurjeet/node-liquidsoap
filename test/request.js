liquidsoap = require("../lib/liquidsoap.js");

opts = {
  auth: "test:test",
  name: "foo",
  host: "localhost",
  port: 8080 }


request = new liquidsoap.RequestQueue(opts);

request.enable(function(err) {
  if (err)
    return console.log("Error creating request source.");
  
  mksafe  = new liquidsoap.Mksafe(opts);

  mksafe.enable(request, function(err) {
    if (err)
      return console.log("Error creating mksafe source.");

    ao = new liquidsoap.OutputAo(opts);

    ao.enable(mksafe, function(err) {
      if (err)
        console.log("Error creating ao source.");

      request.push(["/tmp/foo.mp3"], function (err) {
         if (err)
           console.log("Error pushing request to request source");

         return console.log("All good folks!");
      });
    });
  });
});
