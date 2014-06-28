var cluster = require("cluster");
var CloneRPC = require("../index");


var currentID = 0;

var worker = cluster.fork();
var remote = new CloneRPC({
  sendData: function(data)  { worker.send(data);         },
  getData:  function(fn)    { worker.on ("message", fn); },
  onClone: function(new_remote){
    console.log("We have a cloning", new_remote);
    new_remote.somemethod("call somemethod", function(){
      console.log("new_remote clone has responded to server", arguments);
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