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
    onClone: cloneChild   //Handle when clone is summoned from otherside
  });

  remote.debug = true;
  remote.build( id, 
  {
    initialize: function(id){
      console.log("Worker sends back it's id", id);
    }
  }, 

  function(){
    
    //Both sides ready for use
    //if(id==0){
      
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
      
    //}

  });

}


for(var i = 0;i<4;i++){
  // Starting 4 child processes and creating clone-rpc communication with them
  createWorker(i);
}


// Handle the clones
function cloneChild(clone){

  // New clones comming here and we can start building it

  clone.build("111", {
    cloneServerMethod: function(){
      console.log("cloneServerMethod");
    }
  }, function(){ 
    //Clone ready on both sides
    // start using them

    //Defined as listener
    clone.cloneClientMethod(function(str){
      console.log("cloneClientMethod (s) listen", str);
    })

    //Not listener - one-time callback
    .cloneClientMethod2(function(str){
      console.log("cloneClientMethod (s) once", str);
    })

  })
}
