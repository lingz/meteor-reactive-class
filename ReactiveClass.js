ReactiveClass = function(collection, opts) {
  "use strict";

  var defaultOpts = {
    reactive: true,
    transformCollection: true
  };
  var options = _.extend(defaultOpts, opts);

  // offline fields which we are not going to sync with mongoDB, and its clone
  // containing the mutable version
  var default_offline_fields = ["_dep", "_reactive", "_mongoTracker"];
  var default_do_not_update_fields = ["_id"];
  var offline_fields = Array.prototype.slice.call(default_offline_fields);
  var do_not_update_fields = Array.prototype.slice.call(default_do_not_update_fields);

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
  ReactiveClass.setupTransform = function() {
    var self = this;
    collection._transform = function(doc) {
      return self._transformRecord(doc);
    };
  };

  if (options.transformCollection)
    ReactiveClass.setupTransform();
    

  // decoupling the initializer from the ReactiveClass constructor
  ReactiveClass.initialize = function () {
    this._dep = new Deps.Dependency();
    this._reactive = options.reactive;
  };

  // Takes a record returned from MongoDB and makes it into an instance of
  // this class. Also gives it reactivity if specified
  ReactiveClass._transformRecord = function(doc) {
    var object = new this(doc);
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

  // Registering a do not update field
  ReactiveClass.addDoNotUpdateFields = function(newDoNotUpdateFields) {
    do_not_update_fields = _.union(do_not_update_fields, newDoNotUpdateFields);
  };

  // deregistering an offline field
  ReactiveClass.removeDoNotUpdateFields = function(toRemoveDoNotUpdateFields) {
    if (_.intersection(default_do_not_update_fields,
          toRemoveDoNotUpdateFields).length > 0)
      throw new Meteor.Error(500,
        default_offline_fields.toString() + " are protected do not update fields " +
        "and cannot be removed"
      );
    do_not_update_fields = _.difference(do_not_update_fields,
                                        toRemoveDoNotUpdateFields);
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
      var DummyClass = function() {};
      // multiple inheritance, from both the extended class, and from itself.
      _.extend(DummyClass.prototype, childClass.prototype);
      _.extend(DummyClass.prototype, this.prototype);
      _.extend(constructor, childClass);
      _.extend(constructor, this);
      constructor.prototype = new DummyClass();
    }
    return constructor;
  };


  // Instance methods


  // Get sanitized version of object
  ReactiveClass.prototype.sanitize = function(keepId, isUpdate) {
    var toRemoveFields = keepId ? offline_fields : offline_fields.concat("_id");
    if (isUpdate)
      toRemoveFields = _.union(offline_fields, do_not_update_fields);
    return _.omit(this, toRemoveFields);
  };


  // Checks if there are any remaining data fields on this object.
  ReactiveClass.prototype.exists = function() {
    return collection.findOne(this._id) !== undefined;
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
        "$set": this.sanitize(false, true)
      }, callback);
    }
    this.refresh();
    this.changed();
    return this;
  };


  // Removes a database entry
  ReactiveClass.prototype.remove = function(originalCallback) {
    var self = this;
    var removeCallback = function(error) {
      self.changed();
      if (error) {
        throw error;
      }
    };
    var callback;
    if (originalCallback)
      callback = function(err) {
        originalCallback.call(this, err);
        self.changed();
      };
    else
      callback = removeCallback;
    collection.remove(this._id, callback);
    this.changed();
    return this;
  };

  // Inserts an entry into a database for the first time
  ReactiveClass.prototype.put = function(originalCallback) {
    var self = this;
    var callback;
    var insertCallback = function(error) {
      self.changed();
      if (error)
        throw error;
    };
    if (originalCallback)
      callback = function(err) {
        originalCallback.call(this, err);
        self.changed();
      };
    else
      callback = insertCallback;
    this._id = collection.insert(this.sanitize(true), callback);
    this.refresh();
    return this;
  };

  // Temporarily stops reactivity
  ReactiveClass.prototype.lock = function() {
    this._reactive = false;
    return this;
  };

  // Turns on reactivity again, 
  ReactiveClass.prototype.unlock = function() {
    this._reactive = true;
    this.changed();
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
    if (!newFields) {
      return;
    }
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
    this.changed();
    return this;
  };

  // Reactive function to indicate that the class has changed
  ReactiveClass.prototype.changed = function() {
    if (this._reactive)
      this._dep.changed();
    return this;
  };

  // Reactive variable that invalidates when the object changes
  ReactiveClass.prototype.depend = function() {
    this._dep.depend();
    return this;
  };

  // Poll mongoDB for updates
  ReactiveClass.prototype.poll = function() {
    var self = this;
    var newSelf;
    this._mongoTracker = Deps.autorun(Meteor.bindEnvironment(function(c) {
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
    }));
    return this._mongoTracker;
  };

  // Stops the polling and lets this object be cleaned up
  ReactiveClass.prototype.stopPoll = function() {
    if (this._mongoTracker) {
      this._mongoTracker.stop();
      this._mongoTracker = null;
    }
    return this;
  };

  return ReactiveClass;

};

