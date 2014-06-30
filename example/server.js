var cluster = require("cluster");
var CloneRPC = require("../index");


var createWorker = function(id){

  var worker = cluster.fork();

  // worker.on("message", function(data){
  //   console.log("m:", data.type);
  // })

  var remote = new CloneRPC({
    callbackTimeout: 4000,
    sendData: function(data)  { worker.send(data);         },
    getData:  function(fn)    { worker.on ("message", fn); },
    onClone: cloneChild
  });

  remote.debug = true;
  remote.build( id, 
  {
    initialize: function(id){
      //console.log("Worker sends back it's id", id);
    }
  }, 

  function(){
    //console.log(this);
    //Both sides ready for use
    if(id==0){
      
      // Calling remote methods (chainable)
      this.initialize(function(arg){
        console.log("[initialize]            -    ", arg);
      })

      // It is defined as listener, so it can be called many times by otherside
      .listen(function(str){
        console.log("[listener]              -    ", str);
      })
      
      // Will not be executed
      .dropCallback(function(str){
        console.log("[dropCallback]          -    ", str);
      })
      
      // Will be executed until drop() is called
      .dropListener(function(str){
        console.log("[dropListener]          -    ", str);
      })

      // Cool - infinite callbacks
      .callbackInCallback(function(cb){
        cb(function(str){
          console.log("[callbackInCallback]    -    ", str);
        });
      })

      .createClone();
      
    }

  });

}


for(var i = 0;i<4;i++){
  createWorker(i);
}


// Handle the clones
function cloneChild(clone){
  console.log("cloned", clone);
}
