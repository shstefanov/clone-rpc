var cluster  = require("cluster");
var CloneRPC = require("../index");


var server = new CloneRPC({
  sendData: function(data)  { process.send(data);       },
  getData:  function(fn)    { process.on("message", fn);},
  onClone: function(clone)  {
    console.log("clone server object here", clone);
  }
})

.build({
  id: "client",


  // By default, functions passed as parameters are turned into one-time callback
  // Put in listeners array some method name and you can call it's callbacks many times
  //Methods:
  workerEcho: function(data, cb){
    console.log("in worker echo: ", data);
    cb(null, data);
    // If you want to delete some cb or listener on other side
    // just call cb.drop() and it will disappear
  },

  listeners: ['bind'],
  bind: function(event, listener){
    // process.on("someEvent", listener)
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
  // On this side, clone() returns the clone
  // It uses the transport from remote, but we can define
  // new json transport with:
  // clone.setOptions({
  //   sendData: function(data)  { ... },
  //   getData:  function(fn)    { ... },
  //   onClone:  function(clone) { ... }
  // })
  var clone = remote.clone({ //Return new clone or give it to cb initialized
    somemethod: function(data, cb){
      console.log("somemethod on cloning");
      cb(null, "somemethod response");
      clone.new_remote_method();
    }
  }, function(clone){
    clone.clone({
      childMethod: function(msg, cb){
        console.log("child msg:", msg);
      }
    }, createChildChild)   
  })
  
}

function createChildChild(clone){
  console.log("It is clone of clone");
}