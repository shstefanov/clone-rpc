var cluster  = require("cluster");
var CloneRPC = require("../index");

if(cluster.isMaster) require("./server");
else                 require("./client");