ReactiveClass = function(collection, opts) {
  "use strict";

  var defaultOpts = {
    reactive: true,
    transformCollection: true
  };
  var options = _.extend(defaultOpts, opts);

  // offline fields which we are not going to sync with mongoDB, and its clone
  // containing the mutable version
  var default_offline_fields = ["_dep", "_reactive", "_exists", "_mongoTracker"];
  var offline_fields = Array.prototype.slice.call(default_offline_fields);

  var ReactiveClass = function(fields) {
    _.extend(this, fields);
    ReactiveClass.initialize.call(this);
  };

  if (!collection || !(collection instanceof Meteor.Collection))
    throw new Meteor.Error(500,
      "You must pass in a valid Meteor.Collection"
    );

  ReactiveClass.collection = collection;

  // Let Collection queries automatically return instances of this class
  var setupTransform = function() {
    collection._transform = function(doc) {
      return ReactiveClass._transformRecord(doc);
    };
  };
  if (options.transformCollection)
    setupTransform();

  // decoupling the initializer from the ReactiveClass constructor
  ReactiveClass.initialize = function () {
    this._dep = new Deps.Dependency();
    this._reactive = options.reactive;
    this._exists = false;
    this._mongoTracker = null;
  };

  // Takes a record returned from MongoDB and makes it into an instance of
  // this class. Also gives it reactivity if specified
  ReactiveClass._transformRecord = function(doc) {
    var object = new this(doc);
    if (options.reactive) {
      object._setupReactivity();
    }
    object._exists = true;
    return object;
  };

  // static methods
  ReactiveClass.create = function(newObject, originalCallback) {
    var object = new this(newObject);
    return object.put(originalCallback);
  };

  // reactively fetch an array of objects
  ReactiveClass.fetch = function() {
    var args;

    var objects = [];
    // when this reactively reruns, it will delete all objects of the array
    // and create them fresh
    var queryResults = collection.find.apply(apply, args).fetch();

    // for each of the objects in the list, creative a reactively updating
    // object and insert it into the ith position of the array, only if we
    // aren't already transforming.
    if (!options.transformCollection) {
      var self = this;
      _.map(queryResults, function(record) {
        self._transformRecord(record);
      });
    }

    return objects;
  };

  // fetch a single instance of the class. Is reactive unless an _id string is
  // passed in, in which case it is not reactive.
  ReactiveClass.fetchOne = function() {
    var record;
    // we need to check if the argument passed in was a string, so we can make
    // it non reactive, as it means they are fetching a specific record by id.
    if (arguments.length > 0 && typeof arguments.length[0] == "string")
      record = Deps.nonreactive(function() {
        record = collection.findOne.apply(collection, arguments);
      });
    else
      record = collection.findOne.apply(collection, arguments);

    if (_.isEmpty(record))
      return undefined;

    if (!options.transformCollection)
      record = this._transformRecord(record);

    return record;
  };


  // registering an offline field
  ReactiveClass.addOfflineFields = function(newOfflineFields) {
    offline_fields = _.union(offline_fields, newOfflineFields);
  };

  // deregistering an offline field
  ReactiveClass.removeOfflineFields = function(toRemoveOfflineFields) {
    // we need to protect the default fields
    if (_.intersection(default_offline_fields,
          toRemoveOfflineFields).length > 0)
      throw new Meteor.Error(500,
        default_offline_fields.toString() + " are protected offline fields " +
        "and cannot be removed"
      );
    offline_fields = _.difference(offline_fields, toRemoveOfflineFields);
  };

  // Creates a new class, which double inherits from both the specified child
  // class, and the current Reactive Class.
  ReactiveClass.extend = function(childClass) {
    var args = Array.prototype.splice(arguments);
    var constructor, collection;
    if (!childClass)
      throw new Meteor.Error(500,
        "You must specify the collection you are extending"
      );
    else {
      constructor = function() {
        childClass.apply(this, arguments);
        ReactiveClass.initialize.call(this);
        return this;
      };
      var dummyClass = function() {};
      // multiple inheritance, from both the extended class, and from itself.
      _.extend(dummyClass.prototype, childClass.prototype);
      _.extend(dummyClass.prototype, this.prototype);
      _.extend(constructor, childClass);
      _.extend(constructor, this);
      constructor.prototype = new dummyClass();
    }
    return constructor;
  };


  // Instance methods

  // Setup Reactivity - tells the object to start listening for changes to
  // itself from the server, and if anything changes, it pulls them
  // automatically.
  ReactiveClass.prototype._setupReactivity = function(ignoreFirstTime) {
    var firstTime = ignoreFirstTime ? true : false;
    var self = this;
    var newSelf;
    this._mongoTracker = Deps.autorun(function(c) {
      if (firstTime) {
        firstTime = false;
        return;
      }
      if (!self._reactive)
        return;

      newSelf = collection.findOne(self._id, {transform: null});
      if (newSelf) {
        _.extend(self, newSelf);
      }
      else {
        self._exists = false;
        self._mongoTracker = null;
        c.stop();
      }
      self.changed();
    });
  };

  // Get sanitized version of object
  ReactiveClass.prototype.sanitize = function(keepId) {
    var toRemoveFields = keepId ? offline_fields : offline_fields.concat("_id");
    return _.omit(this, toRemoveFields);
  };


  // Checks if there are any remaining data fields on this object.
  ReactiveClass.prototype.exists = function() {
    this._dep.depend();
    return this._exists;
  };

  // can be optionally called with an update operator. Otherwise, it will just
  // update all current fields on this object on MongoDB. Also can have an
  // optional callback for failure / success.
  ReactiveClass.prototype.update = function() {
    var args, callback;
    var self = this;
    var defaultUpdateCallback = function(err, numUpdated) {
      if (err)
        throw err;
    };

    // extract callback if present
    if (arguments.length > 0 && typeof(arguments[arguments.length - 1]) == "function") {
      callback = arguments[arguments.length - 1];
      args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
    } else {
      callback = defaultUpdateCallback;
      args = Array.prototype.slice.call(arguments);
    }

    // do an update query or just reflect the update on the current object
    if (args.length > 0) {
      collection.update.apply(collection, _.union([this._id], args, callback));
    } else {
      collection.update(this._id, {
        "$set": this.sanitize()
      }, callback);
    }
    this.refresh();
    this.changed();
    return this;
  };


  // Removes a database entry
  ReactiveClass.prototype.remove = function(callback) {
    var self = this;
    var removeCallback = function(error) {
      if (error)
        throw error;
      self._exists = false;
      self._mongoTracker.stop();
      self._mongoTracker = null;
    };
    if (callback) {
      removeCallback = function() {
        callback();
        removeCallback();
      };
    }
    collection.remove(this._id, removeCallback);
    this.changed();
    return this;
  };

  // Inserts an entry into a database for the first time
  ReactiveClass.prototype.put = function(originalCallback) {
    var self = this;
    var callback;
    var insertCallback = function(error) {
      if (error)
        throw error;
      self._setupReactivity();
      self._exists = true;
    };

    if (originalCallback)
      callback = function() {
        arguments[1]();
        insertCallback();
      };
    else
      callback = insertCallback;
    this._id = collection.insert(this.sanitize(true), callback);
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
    this.changed();
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


  return ReactiveClass;
};

