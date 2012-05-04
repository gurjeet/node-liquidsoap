liquidsoap = require("../lib/liquidsoap.js");

opts = {
  auth: "test:test",
  name: "foo",
  host: "localhost",
  port: 8080 }

client = new liquidsoap.Client(opts);

liquidsoap.Request.Queue.create(client, function(err, source) {
  if (err)
    return console.log("Error creating request source.");

  liquidsoap.Metadata.Get.create(source, function (err, source) {
    if (err)
      return console.log("Error creating enabling get metadata callback.");

    liquidsoap.Mksafe.create(source, function(err, source) {
      if (err)
        return console.log("Error creating mksafe source.");

      liquidsoap.Output.Ao.create(source, function(err, source) {
        if (err)
          return console.log("Error creating ao source.");

        source.push("/tmp/bla.mp3", function (err) {
          if (err)
            return console.log("Error pushing request to request source");

          var get_meta = function () {
            source.get_metadata(function (err, res) {
              if (err)
                return console.log("Error grabbing metadata");

              console.log("Latest metadata: \n" + JSON.stringify(res, undefined, 2));

              return console.log("All good folks!");
            });
          };

          setTimeout(get_meta, 1000.);  
        });
      });
    });
  });
});
