var cluster = require("cluster");
var CloneRPC = require("../index");


var currentID = 0;

var worker = cluster.fork();
var remote = new CloneRPC({
  sendData: function(data)  { worker.send(data);         },
  getData:  function(fn)    { worker.on ("message", fn); },
  onClone: function(clone){
    
    console.log("We have a cloning", clone);

    clone.build({
      // Projecting some methods back to other side
      new_remote_method: function(){
        console.log("Called from otherside")
      }
    });
    // We call server.clone() on the other side and clone comes here with it's methods
    clone.somemethod("call somemethod", function(){
      console.log("Calling remote method and executing callback", arguments);
      // Expecting otherside to summon another clone from this rpc node
      // So creating the handler (by default parent node will handle clones)
      clone.setOptions({
        onClone: function(clone_clone){
          // The clone of clone
          console.log("We have clone of clone");
          clone_clone.childMethod("haha", function(response){
            console.log("clone_clone response: ", response);
          })
        }
      })
    })
  }
})


.build({
    id: currentID++,
    //listeners: ['serverEcho'],
    serverEcho: function(data, cb){
      console.log("in server echo: ", data);
      //cb(null, data);

      // setTimeout(function(){
      //   console.log("drop cb");
      //   cb.drop();
      // },500)


      setTimeout(function(){
        console.log("call cb twice in server");
        cb(null, data);
      },1000)
    },

    ready: function(){
      console.log("server ready called")
    }
  })