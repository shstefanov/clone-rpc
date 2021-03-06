var cluster  = require("cluster");
var CloneRPC = require("../index");

var server = new CloneRPC({
  callbackTimeout: 4000,
  sendData: function(data)  { process.send(data);       },
  getData:  function(fn)    { process.on("message", fn);},
  onClone: function(clone)  {
    console.log("clone server object here", clone);
  }
});

server.build( "server", {/*The id, that will be assigned to otherside instance*/  

  listeners: ["listen", "dropListener"], 

  // Write here your custom methods that can be called remotely
  initialize: function(cb){
    // This function is not defined as listener
    // and it's callbacks can be called only once
    cb("initialize callback once");
    cb("initialize callback twice (not working)");
  },
  
  dropCallback: function(cb){
    cb.drop();
    cb("dropCallback once (not working - dropped)");
  },

  dropListener: function(cb){
    cb("Call dropListener 1");
    cb("Call dropListener 2");
    cb("Call dropListener 3");
    cb.drop();
    cb("Call dropListener 4");
  },

  callbackInCallback: function(cb){
    cb(function(cb){
      cb("callbackInCallback ok");
    });
  },

  listen: function(cb){
    //This function is defined as listener, so we can call it's
    // callbacks many times
    cb("Call listener 1");
    cb("Call listener 2");
    cb("Call listener 3");
    cb("Call listener 4");
  },

  createClone: function(){
    //Create clone and handle it 
    //when connection is established
    this.clone(cloneChild); 
  }
}, 

function(){
  //Both sides ready for use
  this.initialize(this.id);
});


// Handle the clones
function cloneChild(clone){
  
  
  clone.build("clone", {
    listeners: ["cloneClientMethod"],
    cloneClientMethod: function(cb){
      console.log("cloneClientMethod");
      cb(1);
      cb(2);
      cb.drop();
      cb(3);
    },
    cloneClientMethod2: function(cb){
      console.log("cloneClientMethod2");
      cb(1);
      cb(2);
      cb(3);
    }
  }, function(){
    //Clone ready on both sides
    // start using them
    clone.cloneServerMethod();
    console.log("clone ready");
  });



}


