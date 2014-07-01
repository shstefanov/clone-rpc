// Fully free of dependencies :)


var getMethods = function(obj){
  var result = [];
  for(key in obj){
    if(typeof(obj[key])==="function"){
      result.push(key);
    }
  }
  return result;
}


// The protocol
// var data = {
//   type:   ["action",     "cb",     "listener",    "destroy_cb", "destroy_listener",    "init"],
//   cb_id: 2,
//   listener_id: 4,
//   action: "actionName"
//   args:   [ ... ],
//   meta:   {cb: 3, listener:4} 
// }


function Transport(options){
  this.__readyState    = 2; 
  if(!options) options = {};
  this.setOptions(options);
  this.__uniqueIndex   = 0;
  this.__callbacks     = {};
  this.__listeners     = {};
  this.__listenersList = {};
  this.__oldCallbacks  = {};
}

Transport.prototype.setOptions = function(options){
  if(options.context)  this.__context = options.context;
  if(options.getData)  this.__defineOnMessage(options.getData);
  if(options.sendData) this.__defineSendData(options.sendData);
  if(options.onClone)  this.__onClone = options.onClone;
  if(typeof options.callbackTimeout === "number") this.__callbackTimeout = options.callbackTimeout;
  else this.__callbackTimeout = 0;
  if(this.__callbackTimeout > 0){
    var self = this;
    var i = setInterval(function(){
      self.__switchCallbacks();
    }, this.__callbackTimeout)
  }
  return this;
};
// Sends init type to other side and gets back 
// init type for constructing remote methods
Transport.prototype.build = function(id, obj, cb){
  if(typeof id ===  "function") cb=id, id=null, obj={};
  if(typeof obj === "function") cb=obj, obj={};
  obj = obj || {};
  this.__handlers = obj;
  if(typeof id === "function"){ this.__buildCallback = id; return this; }
  var self = this;
  if(cb) this.__readyStateCallback = function(){cb.apply(self);};
  this.__send({
    type: "init",
    id: id,
    actions:   obj.availableMethods || getMethods(obj),
    listeners: obj.listeners || [],
    cb_id:     this.__createCallback(function(){
      self.__checkReadyState();
    })
  })
  return this;
};

Transport.prototype.__checkReadyState = function(){
  this.__readyState--;
  if(this.__readyState < 1) this.__readyStateCallback&&this.__readyStateCallback();
}

Transport.prototype.onMessage = function(data){
  var type = data.type;
  // TODO - check if type is of allowed types based on communication protocol
  if(this["__"+type]) this["__"+type](data);
};




// types handlers
Transport.prototype.__init = function(data){
  this.id = data.id;
  if(data.listeners.length>0) this.__registerListeners(data.listeners);
  var callback = this.__createCallbackFromID(data.cb_id);
  if(this.__currentActions){
    for(key in this.__currentActions) {
      var action = key.replace("_", "");
      delete this[action];
    }
  }
  this.__currentActions = {};
  var self = this;
  data.actions.forEach(function(action){
    self.__currentActions["_"+action] = true;
    self[action] = function(){
      var data = {
        type: "action",
        action: action,
        meta: {}
      }
      data.args = argsToRemote(this, arguments, data);
      this.__send(data);
      return this;
    }
  });
  // For releasing clones
  this.__checkReadyState();
  callback();
  if(this.__releaseOnBuild) {
    this.__releaseOnBuild();
    delete this.__releaseOnBuild;
  }
  if(this.__buildCallback) {
    this.__buildCallback.apply(this);
  }
};

Transport.prototype.__action = function(data){
  if( typeof this.__handlers[data.action]==="function"){
    this.__handlers[data.action].apply(this.__context || this, argsFromRemote(this, data.args, data))
  }
};

Transport.prototype.__cb = function(data){
  var hndl;
  var cb_id = "_"+data.cb_id;
  if(cb_id in this.__callbacks){
    var hndl = this.__callbacks[cb_id];
  }
  else if(cb_id in this.__oldCallbacks){
    var hndl = this.__oldCallbacks[cb_id];
  }
  else{
    return;
  }
  var ctx = hndl.ctx || this;
  hndl.apply(ctx, argsFromRemote(this, data.args, data));
  this.__dropCallback(data.cb_id);
  
};

Transport.prototype.__listener = function(data){
  var listener_id = "_"+data.listener_id;
  if(listener_id in this.__listeners){
    var hndl = this.__listeners[listener_id]
    var ctx = hndl.ctx || this;
    hndl.apply(ctx, argsFromRemote(this, data.args, data));
  }
};

Transport.prototype.__destroy_cb = function(data){
  this.__dropCallback(data.cb_id);
};

Transport.prototype.__destroy_listener = function(data){ 
  this.__dropListener(data.listener_id);
};




// Listeners
Transport.prototype.__registerListeners = function(listeners){
  var self = this;
  listeners.forEach(function(listener){
    self.__listenersList[listener] = true;
  })
};
Transport.prototype.__isListener = function(action){
  return action in this.__listenersList;
};

Transport.prototype.__createListener = function(fn){
  var id = this.__uniqueIndex++;
  this.__listeners["_"+id] = fn;
  return id;
};

Transport.prototype.__dropListener = function(listenerID){
  var lid = "_"+listenerID;
  if(lid in this.__listeners) delete this.__listeners[lid];
};

Transport.prototype.__runListener = function(listenerID, args){
  var lid = "_"+listenerID;
  if(lid in this.__listeners) {
    var hndl = this.__listeners[lid];
    args = argsFromRemote(this, args);
    hndl.ctx?hndl.apply(hndl.ctx, args):hndl(args);
  };
};

Transport.prototype.__createListenerFromID = function(id){
  var self = this, droped = false;
  var fn = function(){
    if(droped===true) return;
    var data = {type:"listener", meta:{}, listener_id:id};
    data.args = argsToRemote(self, arguments, data);
    self.__send(data);
  };
  fn.drop = function(){
    droped = true;
    self.__send({
      type: "destroy_listener",
      listener_id: id
    });
  }
  return fn;
};



// Callbacks
Transport.prototype.__switchCallbacks = function(){
  this.__oldCallbacks = this.__callbacks;
  this.__callbacks = {};
};

Transport.prototype.__createCallback = function(fn){
  var id = this.__uniqueIndex++;
  this.__callbacks["_"+id] = fn;
  return id;
};

Transport.prototype.__dropCallback = function(callbackID){
  var cid = "_"+callbackID;
  if(cid in this.__callbacks) delete this.__callbacks[cid];
};

Transport.prototype.__runCallback = function(callbackID, args){
  var cid = "_"+callbackID;
  if(cid in this.__callbacks){
    var hndl = this.__callbacks[cid];
    args = argsFromRemote(this, args);
    hndl.ctx?hndl.apply(hndl.ctx, args):hndl(args);
    delete this.__callbacks[cid];
  }
};

Transport.prototype.__createCallbackFromID = function(id){
  var self = this, sent = false;
  var fn = function(){
    if(sent === true) return;
    sent = true;
    var data = {type:"cb", meta:{}, cb_id:id };
    data.args = argsToRemote(self, arguments, data);
    self.__send(data);
  }

  fn.drop = function(){
    sent = true;
    self.__send({
      type: "destroy_cb",
      cb_id: id
    });
  }
  return fn;
};


Transport.prototype.__defineSendData = function(fn){
  this.__send = fn;
  return this;
};

Transport.prototype.__defineOnMessage = function(fn){
  var self = this;
  fn.call(this, function(data){
    self.onMessage(data);
  });
  return this;
};










//Clone feature

Transport.prototype.clone = function(options, cb){
  if(typeof options==="function"){
    cb = options, options = {};
  }
  options = options || {};
  var self = this;
  if(!options.callbackTimeout) options.callbackTimeout = this.__callbackTimeout;
  if(!options.onClone) options.onClone = this.__onClone;

  var clone = new Transport();

  var getData;
  var initCallback = function(data){
    var otherSideListener = this.__createListenerFromID(data.listener_id);
    clone.setOptions({
      sendData:        otherSideListener,
      getData:         function(fn){ getData = function(data){fn(data);}; },
      onClone:         options.onClone,
      callbackTimeout: options.callbackTimeout
    });
    //clone.build(obj);
    cb && cb(clone);
  }

  var getDataListener = function(data){ getData(data); };

  this.__send({
    type: "createClone",
    listener_id: this.__createListener(getDataListener),
    init_callback_id: this.__createCallback(initCallback)
  })
  return clone;
};

Transport.prototype.__createClone = function(data){
  if(!this.__onClone) return;
  var callback          = this.__createCallbackFromID(data.init_callback_id);
  var otherSideListener = this.__createListenerFromID(data.listener_id);
  var getData;
  var getDataListener = function(data){
    getData(data);
  }
  var listener_id = this.__createListener(getDataListener)

  var clone = new Transport({
    sendData: otherSideListener,
    getData:  function(fn){ getData = function(data){fn(data);};},
    onClone:  this.__onClone
  })
  var self = this;
  clone.__releaseOnBuild = function(){
    self.__onClone(clone)
  }
  callback({ listener_id: listener_id });

};




//Helpers
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
  var parsed = data.args = new Array(args.length);
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

module.exports = Transport;