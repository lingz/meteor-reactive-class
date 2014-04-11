# Reactive Class for Meteor

Reactive classes with data backed by Meteor collections! Allows for simple two
way data binding, as well as for Object Oriented Programming without losing
any of the benefits of reactive Meteor collections. Objects are **not
reinstantiated** when syncing with the corresponding collection record updates
and therefore can maintain state.

It also acts as a database wrapper over MongoDB and allows for simply managing
data in a natural, object oriented way. Call `.update()` to reflect local
changes in the DB, and `.refresh()` to get changes in the DB onto the local
object! Alternatively, use the polling mode, and have the objects listen for
mongoDB updates, and update themselves reactively.

[![Build Status](https://travis-ci.org/lingz/meteor-reactive-class.svg)](https://travis-ci.org/lingz/meteor-reactive-class)

## Install

1. Install [Meteorite](https://github.com/oortcloud/meteorite/)
2. `mrt add reactive-class`

## Example

Simple setup, with natural javascript prototype based classes. Integrate it
into your existing codebase without refactoring using Meteor Collection
transforms. By default, it will automatically cast all objects returned by the
queries as objects of your defined class.

```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection);
Post.prototype.getName = function() {
  return this.name;
}
```

Easily create a local object and put it into the DB.
```javascript
post = new Post({name: "My Cool Post"})
console.log(post) 
>> {name: "My Cool Post"}

post.put();
console.log(post)
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
```

Reactively track the object!
```javascript
Deps.autorun(function() {
  console.log("Name changed, it is now: " + post.get("Name"));
});
```

Update the object just like how you would any other regular javascript object,
and reflect those changes on MongoDB.
```javascript
post.name = "My Pretty Cool Pet";
post.update();
>> Name changed, it is now: My Very Cool Post // Invalidated autorun
```

Collection updates automatically invalidate the object and updates all its
fields. Also, it invalidates anywhere the object has been reactively used.
```javascript
PostCollection.update({name: "My Cool Post"},
  {
    "$set": {name: "My Very Cool Post"}
  }
); 
post.refresh();
console.log(post.name);
>> Name changed, it is now: My Very Cool Post // Invalidated autorun
>> My Very Cool Post // local object got updated also
```

## Options

You can pass these into the ReactiveClass constructor.

```javascript
Post = new ReactiveClass(PostCollection, {
  reactive: true,
  transformCollection: true
});
```

Field               | Default   | Explanation
--------------------|-----------|------------
reactive            | true      | Whether objects are by default reactive, that is their setters invalidate.
transformCollection | true      | Whether collection queries automatically return objects cast into this class. Set to false if you are using the same collection for multiple classes.

## Setup

### Simple Class
The easiest way to create a Reactive Class.  

```javascript
// Creating a collection and a Reactive Class backed on it
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection);
Post.prototype.getName = function() {
  return this.name;
}
```

### Inheritance
Extend an existing class. This performs multiple inheritance, creating a new
class that inherits from both the class being extended, and the reactive class
doing the extending, with the reactive base class getting the higher priority
(its methods and fields will overwrite the extended class's ones with the same
name).

```javascript
Post = function(name) {
  console.log("Constructing post with name: " + name);
  this.name = name;
};
Post.prototype.getName = function() {
  return this.name
}
PostCollection = new Meteor.Collection("posts");
ReactivePost = ReactiveClass(PostCollection).extend(Post);

PostWithComments = function (commentLimit) {
  this.commentLimit = commentLimit;
}

ReactivePostWithComments = ReactivePost.extend(PostWithComments);

```

### Coffeescript based inheritance
Easy coffeescript extension that fits well with the syntax. Note that you must
call `ClassName.initiliaze.call(@)` during the constructor, or the
ReactiveClass will not correctly get its fields.

```coffeescript
PostCollection = new Meteor.Collection("posts");
class Post extends ReactiveClass(PostCollection)
  constructor: (name) ->
    console.log "Constructing post with name: " + name
    this.name = name
    Post.initiliaze.call(@) # Important! Not optional!

  getName: () ->
    return this.name
```

## Interacting With Mongo

### Instantiating Objects
Objects can be created on the client and not linked to any object in the
collection. When ready to insert it into the collection, just call `.put()`.
Alternatively, call `.create()`, which both instantiates a local object, and
inserts it into mongoDB.

Note that on the client all database operations appear synchronous due
to latency compensation but in fact need to asynchronously validate all
operations with the server. Use `.exists()` to reactively check if it exists
in the database.

```javascript
Post = new ReactiveClass(PostCollection);

var post = new Post({name: "My Cool Post"});
post.put()

// or just create directly
var newPost = Post.create({name: "New Post"});
```

### Fetching objects
Once you've assigned a collection to a class, objects of this class
automatically get cast into that class. You can turn this off by passing
`{transformCollection: false}` to `ReactiveClass(collection, options)`. Note
that if you are using the same collection for multiple classes, it is highly
recommended that you set it to false on every instance, or all your objects
will be of the type of the last class you defined.

If you are not using the transform option, you can fetch records from the
collection of the class type by using the `.fetchOne()` or `.fetch()` methods.
These have identical signatures to Meteor's `.find()` and `.findOne()` except
they always transform the results into instances of your class, and they
return objects instead of cursors always.

With Transform:
```javascript
var Post = new ReactiveClass(PostCollection);

post = PostCollection.findOne({commentCount: {$gte: 2}});
posts = PostCollection.find({commentsCount: {"$gte": 2}});
```

Without Transform:
```javascript
var Post = new ReactiveClass(PostCollection, {transformCollection: false});

post = Post.fetchOne({commentCount: {$gte: 2}});
posts = Post.fetch({commentsCount: {"$gte": 2}});
```

### Keeping in sync with MongoDB
Call `update()` to update MongoDB with all current fields. You can also use
`update(query)` to make an update query with the current object. The object
will automatically reflect the updated state it should have after the update
query. Use `.refresh()` to pull all the latest fields from MongoDB and update
the local object.

#### Manual refresh
```javascript
post = new Post.create({name: "Cool Post"});
post.name = "Very Cool Post";
post.update();

PostCollection.findOne({name: "Very Cool Post"});
>> {_id: "YN2nZmczPsk3jvPuL", name: "Very Cool Post"}

post.update({
  $set: {name: "Very Very Cool Post"}
});
post.refresh();
console.log(post);
>> {_id: "YN2nZmczPsk3jvPuL", name: "Very Very Cool Post"}
```

The other option is to use `.poll()`, where the object will listen for changes
from the DB. 

**Warning:** Use with care and only if you know what you're doing. When an
object is polling, it **cannot be garbage collected**.

If you are programmatically polling a large number of objects, you may cause
memory leaks. Thus, you must ensure that you stop all polling before you lose
references to an object. The `.poll()` method returns a computation object. To
stop the polling, either call `.stop()` on this computation object, or call
`object.stopPoll()`. This allows the object to get garbage collected again.

#### Polling refresh
```javascript
post = new Post.create({name: "Cool Post"});
var computation = post.poll();

Deps.autorun(function() {
  console.log("New name: " + post.get("name"));
});

post.update({
  $set: {name: "Very Very Cool Post"}
});
>> "New name: Very Very Cool Post"

post.update({
  $set: {name: "Very Very Very Cool Post"}
});
>> "New name: Very Very Very Cool Post"

// Call one of the two below to end the poll
computation.stop();
post.stopPoll();
```

### Removing an object
You can make an object remove its corresponding record with
`.remove(callback)`. Again, we have the same behavior as was described with
`.put()`, where it will appear to work instantly, but needs to asynchronously
validate the remove with the server. Again use `.exists()` to check if it is
still in the database.

```javascript
post.remove();
console.log(post.exists());
>> false
```

### Adding / Removing offline fields
Sometimes you want your object to hold fields that do not get put into mongo.
```javascript
Post.addOfflineField(["currentComment", "currentPage"]);
Post.removeOfflineField(["currentPage"]);
post = Post.create({name: "Cool Post", currentPage: 2});

post.currentComment = 3;
post.update();

console.log(PostCollection.findOne({name: "Cool Post"}));
>> {_id: "YN2nZmczPsk3jvPuL", name: "Cool Post"}
console.log(post);
>> {_id: "YN2nZmczPsk3jvPuL", name: "Cool Post", currentPage: 2, currentComment: 3 }
```

## Reactivity

### Queries
You may want to use reactive or non-reactive queries depending on whether you
want to maintain state on the object itself. Reactive queries have the
advantage that your object data is always on the live-data. However, they have
the disadvantage of destroying the reference to the old object, so it cannot
maintain any sort of state. 

#### Reactive Query
```javascript
var post;
Deps.autorun(function() {
  post = PostCollection.findOne("YN2nZmczPsk3jvPuL")
  console.log(post)
});
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}

post.page = 2;

PostCollection.update({name: "My Cool Post", {
  {$set: {name: "My Very Cool Post"}}
});

console.log(post.name);
>> "My Very Cool Post"
console.log(post.page);
>> undefined // reference to original object is lost
```

Non-Reactive queries allow you to hold onto a single reference of an object.
You can do non-reactive queries just by passing `{reactive: false}`, or using
the query outside a computation. This allows you to hold state on an object.
If you need to both hold state, and ensure your data is always live, either
repeatedly call `.refresh()`, or use `.poll()`.

#### Non-Reactive Query
```javascript
var post;
Deps.autorun(function() {
  post = PostCollection.findOne("YN2nZmczPsk3jvPuL", {reactive: false})
  console.log(post)
});
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}

post.page = 2;

PostCollection.update({name: "My Cool Post", {
  {$set: {name: "My Very Cool Post"}}
});

console.log(post.name);
>> "My Very Cool Post" // object is stale
post.refresh()
console.log(post.name);
>> "My Very Very Cool Post" // object is now up to date
console.log(post.page);
>> 2 // we still have the original object
```

### Using Set / Get
You can use setters and getters to make your access / modifications reactive.
Essentially, this treats the entire object as if it was a `Session` variable.
`.set()` operations are **not** reflected on MongoDB, and it is required you
call `.update()` after if you want the changes to carry over to mongoDB.

```javascript
post = Post.create({name: "My Post"})
Deps.autorun(function() {
  console.log(post.get("name"));
});
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Post"}
post.set("name", "My cool post");
>> {_id: "YN2nZmczPsk3jvPuL", name: "My cool post"}
```

### Using Depend / Changed
You can watch an object for change explicitly by calling depend on it. Then,
when the object changes via, `.set()`, `.poll()`, `.update()` or `.refresh()`,
the computation will re-run. Note, that direct assignments will not invalidate
the object, however, or you can use `.changed()` to invalidate it manually.

```javascript
Deps.autorun(function() {
  post.depend();
});
post.name = "New Name";
post.changed();
```

### Use Lock / Unlock to toggle reactivity
Sometimes you don't want an object to reactively update for a period of time.
This might be because, you are temporarily setting fields, and don't want them
to get overwriten by a `.poll()` or `.refresh()`, or maybe you just want to
limit UI redraws. To do this, just use `.lock()` to temporarily disable all
invalidations of the object. When you a ready to reactivate reactivity, just
call `.unlock()` which will cause an immediate invalidation of the object.

```javascript
post.lock()
post.status = "Pending...";
Meteor.call("Some long method", function() {
  post.status = "Complete";
  post.unlock();
})
```

## Full Specification

Listed here are all the static and instance methods provided through
ReactiveClass.

**Beware of Namespace conflicts**. Your Mongo object cannot have the same name
as one of the instance methods, or you will overwrite it. If you have a
namespace conflict on your object field that cannot be changed, open an issue.
If this is a common problem, I might add a prefix option, to change the names
of some methods. However, as it stands, the current terseness is nice.

### Static Methods
Static methods are called as such:
```javascript
Post = new ReactiveClass(PostCollection);
Post.staticMethod();
```

Assuming the class is named Class.

`Class = new ReactiveClass(ClassCollection)`

Signature | Return | Explanation
----------|--------|------------
`new Class()` | instance of Class | instantiates a local object. It has no database presence yet
`.create(object, [callback])` | instance of Class | Creates an object and instantiates it in the database
`.fetch(selector, [options])` | array of instance of Class | Identical to [Collection.find()](http://docs.meteor.com/#find) except returns an array of class instances instead of a cursor. This method is reactive.
`.fetchOne(selector, [options])` | instance of Class | Identical to [Collection.findOne()](http://docs.meteor.com/#findone) except it returns an class instance instead of a record. This method is reactive unless an id string is passed in, in which case it is not.
`.addOfflineFields(newOfflineFields)` | undefined | Adds fields which are not to be synced with MongoDB
`.removeOfflineFields(toRemoveOfflineFields)` | undefined | Inverse operation of `.addOfflineFields()`
`.extend(childClass)` | new Class | Creates a new class, which double inherits from both the specified child class, and the current Reactive Class.

### Instace Methods
Instance methods are called like this
```javascript
var post = new Post({name: "My Cool Post"});
post.instanceMethod();
```

Signature | Return | Explanation
----------|--------|------------
`.put([callback])` | this | Puts this object into MongoDB
`.update([modifier], [options], [callback])` | this | If called without arguments, then tries to update all fields of the object with MongoDB. Otherwise, has an idetical signature to [Collection.update()](http://docs.meteor.com/#update), except it specifies the id for you.
`.remove([callback])` | this | Remove the object's record from MongoDB
`.exists()` | boolean | returns whether the object exists in mongoDB. Will only change after a database operation has been validated by the server.
`.santitize()` | object | returns a copy of the object with all offline fields removed.
`.lock()` | this | Temporarily disables all reactive updates on this object.
`.unlock()` | this | Re-enables all reactive updates on this object. This won't turn on reactivity, if the class was created with `{reactive: false}`.
`.refresh()` | this | Synchronizes all fields of the object with mongoDB, even if reactivity is turned off.
`.get(field)` | value | Reactively returns a top level field of this object
`.set(field, value)` | this | Sets a top level field of this object and invalidates computations tracking the object. Does not cause a mongoDB update.
`.changed()` | this | Invalidates all computations tracking this object.
`.depend()` | this | Makes the current computation reactively track this object.
`.poll()` | computation | Tells an object to watch the database for updates. Returns a computation object, with a `.stop()` method to end the `.poll()`. Polling objects cannot be garbage collected.
`.stopPoll()` | this | Tells an object to stop polling and allows it to be garbage collected again.

