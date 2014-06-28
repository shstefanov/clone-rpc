

var getMethods = function(obj){
  var result = [];
  for(key in obj){
    if(typeof(obj[key])==="function"){
      result.push(key);
    }
  }
  return result;
}

// var data = {
//   type:   ["action",     "cb",     "listener",    "destroy_cb", "destroy_listener",    "init"],
//   cb_id: 2,
//   listener_id: 4,
//   action: ["action_name", "cb_id", "listener_id", undefined],
//   args:   [1,2,3,4,5,6],
//   //describes args
//   meta:   {cb: 3, listener:4} 
// }


function Transport(options){
  this.setOptions(options);
  this.__uniqueIndex = 0;
  this.__callbacks = {};
  this.__listeners = {};
  this.__listenersList = {};
}

module.exports = Transport;

Transport.prototype = {
  setOptions: function(options){
    if(options.getData)  this.__defineOnMessage(options.getData);
    if(options.sendData) this.__defineSendData(options.sendData);
    if(options.onClone)  this.__onClone = options.onClone;
    return this;
  },
  // Sends init type to other side and gets back 
  // init type for constructing remote methods
  build: function(obj){ 
    this.id = obj.id;
    this.__handlers = obj;
    this.send({
      type: "init",
      id: obj.id,
      actions: getMethods(obj),
      listeners: obj.listeners || []
    })
    return this;
  },
  
  onMessage: function(data){
    var type = data.type;
    if(this["__"+type]) this["__"+type](data);
  },




  // types handlers
  __init: function(data){
    this.id = data.id;
    if(data.listeners.length>0) this.__registerListeners(data.listeners);
    var self = this;
    data.actions.forEach(function(action){
      self[action] = function(){
        var data = {
          type: "action",
          action: action,
          meta: {}
        }
        data.args = argsToRemote(self, arguments, data);
        self.send(data)
      }
    })
  },

  __action: function(data){
    if(data.action in this.__handlers && typeof this.__handlers[data.action] === "function"){
      this.__handlers[data.action].apply(this, argsFromRemote(this, data.args, data))
    }
  },

  __cb: function(data){
    var cb_id = "_"+data.cb_id;
    if(cb_id in this.__callbacks){
      var hndl = this.__callbacks[cb_id]
      var ctx = hndl.ctx || this;
      hndl.apply(ctx, argsFromRemote(this, data.args, data));
      this.__dropCallback(data.cb_id);
    }
  },

  __listener: function(data){
    var listener_id = "_"+data.listener_id;
    if(listener_id in this.__listeners){
      var hndl = this.__listeners[listener_id]
      var ctx = hndl.ctx || this;
      hndl.apply(ctx, argsFromRemote(this, data.args, data));
    }
  },

  __destroy_cb: function(data){
    this.__dropCallback(data.cb_id);
  },

  __destroy_listener: function(data){ 
    this.__dropListener(data.listener_id);
  },




  __registerListeners: function(listeners){
    var self = this;
    listeners.forEach(function(listener){
      self.__listenersList[listener] = true;
    })
  },
  __isListener: function(action){
    return action in this.__listenersList;
  },




  __createListener: function(fn){
    var id = this.__uniqueIndex++;
    this.__listeners["_"+id] = fn;
    return id;
  },

  __dropListener: function(listenerID){
    var lid = "_"+listenerID;
    if(lid in this.__listeners) delete this.__listeners[lid];
  },

  __runListener: function(listenerID, args){
    var lid = "_"+listenerID;
    if(lid in this.__listeners) {
      var hndl = this.__listeners[lid];
      args = argsFromRemote(this, args);
      hndl.ctx?hndl.apply(hndl.ctx, args):hndl(args);
    };
  },

  __createListenerFromID: function(id){
    var self = this;
    var fn = function(){
      var data = {type:"listener", meta:{}, listener_id:id};
      data.args = argsToRemote(self, arguments, data);
      self.send(data);
    };
    fn.drop = function(){
      self.send({
        type: "destroy_listener",
        listener_id: id
      });
    }
    return fn;
  },



  __createCallback: function(fn){
    var id = this.__uniqueIndex++;
    this.__callbacks["_"+id] = fn;
    return id;

  },

  __dropCallback: function(callbackID){
    var cid = "_"+callbackID;
    if(cid in this.__callbacks) delete this.__callbacks[cid];
  },

  __runCallback: function(callbackID, args){
    var cid = "_"+callbackID;
    if(cid in this.__callbacks){
      var hndl = this.__callbacks[cid];
      args = argsFromRemote(this, args);
      hndl.ctx?hndl.apply(hndl.ctx, args):hndl(args);
      delete this.__callbacks[cid];
    }
  },

  __createCallbackFromID: function(id){
    var self = this;
    var fn = function(){
      var data = {type:"cb", meta:{}, cb_id:id };
      data.args = argsToRemote(self, arguments, data);
      self.send(data);
    }
    fn.drop = function(){
      self.send({
        type: "destroy_cb",
        cb_id: id
      });
    }
    return fn;
  },


  __defineSendData: function(fn){
    this.send = fn;
    return this;
  },

  __defineOnMessage: function(fn){
    var self = this;
    fn.call(this, function(data){
      self.onMessage(data);
    });
    return this;
  },










  //Clone feature



  clone: function(obj){
    var self = this;

    var clone = new Transport({});

    var getData;
    var initCallback = function(data, release){ //release is callback id
      var otherSideListener = this.__createListenerFromID(data.listener_id);
      clone.setOptions({
        sendData:function(data){otherSideListener(data)},
        getData: function(fn){ getData = function(data){fn(data);}; },
        onClone: self.__onClone
      });

      console.log("??? clone.build");
      clone.build(obj);
      release();
    }

    var getDataListener = function(data){ getData(data); };

    this.send({
      type: "createClone",
      listener_id: this.__createListener(getDataListener),
      init_callback_id: this.__createCallback(initCallback)
      // id: this.__uniqueIndex++,
      // actions: getMethods(obj),
      // listeners: obj.listeners || []
    })
    return clone;
  },

  __createClone: function(data){
    if(!this.__onClone) return;
    var callback          = this.__createCallbackFromID(data.init_callback_id);
    var otherSideListener = this.__createListenerFromID(data.listener_id);
    var getData;
    var getDataListener = function(data){
      getData(data);
    }
    var listener_id = this.__createListener(getDataListener)

    var clone = new Transport({
      sendData: function(data){otherSideListener(data);},
      getData:  function(fn){ getData = function(data){fn(data);};},
      onClone:  this.__onClone
    })
    var self = this;
    callback({ listener_id: listener_id }, function(){
      self.__onClone(clone)
    });

    // clone.build({});
  }















}

var argsFromRemote = function(transport, args, data){
  var parsed = new Array(args.length);
  for(var i=0;i<args.length;i++){    var arg = args[i];
    if(data.meta.listener===i && typeof arg==="number"){
      parsed[i] = transport.__createListenerFromID(arg)
    }
    else if(data.meta.cb===i && typeof arg==="number"){
      parsed[i] = transport.__createCallbackFromID(arg)
    }
    else{
      parsed[i] = args[i];
    }
  }
  return parsed;
};

var argsToRemote = function(transport, args, data){
  var parsed = new Array(args.length);
  for(var i=0;i<args.length;i++){    var arg = args[i];
    
    if(typeof arg==="function"){
      if(data.type =="action" && transport.__isListener(data.action)){
        parsed[i] = transport.__createListener(arg);
        data.meta.listener = i;
      }
      else{
        parsed[i] = transport.__createCallback(arg);
        data.meta.cb = i; 
      }
    }
    // Call toJSON() if available
    else if(arg&&arg.toJSON) parsed[i] = arg.toJSON();
    else parsed[i] = arg;
  }
  return parsed;
};