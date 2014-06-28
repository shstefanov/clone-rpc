var cluster = require("cluster");
var CloneRPC = require("../index");


var server = new CloneRPC({
  sendData: function(data)  { process.send(data);       },
  getData:  function(fn)    { process.on("message", fn);},
  onClone: function(clone)  {
    console.log("clone request from server to client", clone);
  }
})
.build({
  id: "client",
  listeners: ['bind'],
  //Methods:
  workerEcho: function(data, cb){
    console.log("in worker echo: ", data);
    cb(null, data);

  },
  bind: function(event, cb){

  }
});

setTimeout(function(){
  // Calling the remote method and waiting for callback
  server.serverEcho("test", function(){
    console.log("I have response from server: ", arguments);
    clone(server); // run clone tester
  });
}, 1500)




function clone(remote){
  console.log("clone tester");
  remote.clone({
    somemethod: function(data, cb){
      console.log("somemethod on cloning");
      cb(null, "somemethod response");
    }
  })
}