ReactiveClass = function(collection, opts) {
  var defaultOpts = {
    reactive: true
  };
  var options = _.extend(defaultOpts, opts);

  // offline fields which we are not going to sync with mongoDB, and its clone
  // containing the mutable version
  var default_offline_fields = ["_dep", "_reactive"];
  var offline_fields = Array.prototype.slice.call(default_offline_fields);


  ReactiveClass = function(fields) {
    _.extend(this, fields);
    ReactiveClass.initialize.call(this);
  };

  // decoupling the initializer from the ReactiveClass constructor
  ReactiveClass.initialize = function () {
    this._dep = new Deps.Dependency();
    this._reactive = options.reactive;
  };


  if (!collection || !(collection instanceof Meteor.Collection))
    throw new Meteor.Error(500,
      "You must pass in a valid Meteor.Collection"
    );

  ReactiveClass.collection = collection;

  // function compatible with Meteor's transformer that takes a MongoDB record
  // and makes it into a self updating version of the class
  ReactiveClass.transform = function(doc) {
    var firstTime = true;
    var object = new this(doc);
    Deps.autorun(function() {
      // don't update again the first time
      if (firstTime) {
        firstTime = false;
        return;
      }
      // don't update if the object is not reactive
      if (!object._reactive)
        return;
      _.extend(object, collection.findOne(this._id));
    });
    return object;
  };

  // static methods
  ReactiveClass.create = function(fields) {
    var id = collection.insert(params);
    return this.fetchOne(id);
  };

  ReactiveClass.fetchOne = function(query, opts) {
    var record;
    if (opts && opts.reactive)
      record = collection.findOne(query);
    else
      record = Deps.nonreactive(function() {
        return collection.findOne(query);
      });
    if (_.isEmpty(record))
      return undefined;
    return this.transform(record);
  };

  // reactively fetch an array of objects
  ReactiveClass.fetch = function(query, opts) {
    var args, opts;
    var opts = arguments[arguments.length - 1]; 
    if (lastArg && lastArg.reactive) {
      args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
    } else {
      args = Array.prototype.slice.call(arguments);
    }
    var objects = [];
    // when this reactively reruns, it will delete all objects of the array
    // and create them fresh
    var queryResults;
    if (opts && opts.reactive) {
      queryResults = collection.find.apply(args).fetch();
    } else {
      Deps.nonreactive(function() {
        queryResults = collection.find.apply(args).fetch();
      });
    }
    for (var i = 0, length = queryResults.length; i++; i < queryResultsLength) {
      // for each of the objects in the list, creative a reactively updating
      // object and insert it into the ith position of the array
      var localObject = new this.transform(queryResults[i]);
      objects[i] = localObject;
    }
    return objects;
  };

  // registering an offline field
  ReactiveClass.addOfflineField = function(newOfflineFields) {
    offline_fields = _.union(offline_fields, newOfflineFields);
  };

  // deregistering an offline field
  ReactiveClass.removeOfflineField = function(toRemoveOfflineFields) {
    // we need to protect the default fields
    if (_.intersection(default_offline_fields,
          toRemoveOfflineFields).length > 0)
      throw new Meteor.Error(500,
        default_offline_fields.toString() + " are protected offline fields " +
        "and cannot be removed"
      );
    offline_fields = _.difference(offline_fields, toRemoveOfflineFields);
  };


  // Instance methods

  // Get sanitized version of object
  ReactiveClass.prototype.sanitize = function(keepId) {
    var toRemoveFields = keepId ? offline_fields.concat("_id") : offline_fields;
    return _.without(this, toRemoveFields);
  };

  // reflect all current updates onto mongo
  var defaultUpdateCallback = function(err, numUpdated) {
    if (err)
      throw new Meteor.Error(500,
        "Update of object with _id " + this._id
      );
  };

  // can be optionally called with an update operator. Otherwise, it will just
  // update all current fields on this object on MongoDB. Also can have an
  // optional callback for failure / success.
  ReactiveClass.prototype.update = function() {
    var args, callback;
    // extract callback if present
    if (typeof(args[args.length - 1]) == "function") {
      callback = args[args.length - 1];
      args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
    } else {
      callback = defaultUpdateCallback;
      args = Array.prototype.slice.call(arguments);
    }
    // do an update query or just reflect the update on the current object
    if (args.length > 0) {
      collection.update.apply(_.union([this._id], args, callback));
      if (!this._reactive) this.refresh();
    } else {
      collection.update(this._id, {
        "$set": this.sanitize()
      }, callback);
    }
  };

  // Inserts an entry into a database for the first time
  ReactiveClass.prototype.put = function() {
    var firstTime = true;
    var id = collection.insert(this.sanitize(true));
    this._id = id;
    Deps.autorun(function() {
      if (firstTime) {
        firstTime = false;
        return;
      }
      if (!this._reactive)
        return;
      _.extend(this, collection.findOne(this._id));
    });
    return this;
  };

  // Temporarily stops reactivity
  ReactiveClass.prototype.lock = function() {
    this._reactive = true;
    return this;
  };

  // Turns on reactivity again, 
  ReactiveClass.prototype.unlock = function() {
    this._reactive = false;
    this.refresh();
    return this;
  };

  // Force a one-off database refresh
  ReactiveClass.prototype.refresh = function() {
    if (!this._id)
      throw new Meteor.Error(500,
        "Cannot refresh as this object has no _id. " +
        "Perhaps it was never inserted before."
      );
    var newFields = collection.findOne(this._id);
    if (!newFields)
      throw new Meteor.Error(500,
        "Cannot refresh as no object with _id " +
        this._id + " was found in the collection."
      );
    _.extend(this, newFields);
    return this;
  };

  // Reactive getter
  ReactiveClass.prototype.get = function(field) {
    this.depend();
    return this[field];
  };

  // Reactive setter
  ReactiveClass.prototype.set = function(field, value) {
    this[field] = value;
    return this;
  };

  // Reactive function to indicate that the class has changed
  ReactiveClass.prototype.changed = function() {
    this._dep.changed();
    return this;
  };

  // Reactive variable that invalidates when the object changes
  ReactiveClass.prototype.depend = function() {
    this._dep.depend();
    return this;
  };

  // extending
  var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { 
    for (var key in parent) { 
      if (__hasProp.call(parent, key))
        child[key] = parent[key]; 
    } 
    function ctor() { 
      this.constructor = child; 
    } 
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    return child; 
  };

  ReactiveClass.extend = function(childClass) {
    var args = Array.prototype.splice(arguments);
    var constructor, collection;
    if (!childClass)
      throw new Meteor.Error(500,
        "You must specify the collection you are extending"
      );
    else {
      if (typeof(args[0]) != "function")
        throw new Meteor.Error(500,
          "You must specify the collection you are extending"
        );
      collection = args[1];
      constructor = function() {
        childClass.call(this);
        ReactiveClass.initialize.call(this);
      };
      __extends(constructor, childClass);
      __extends(constructor, ReactiveClass);
    }
    return constructor;
  };

  return ReactiveClass;
};

