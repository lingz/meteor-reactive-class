#Reactive Class for Meteor

Reactive classes with data reactively backed by Meteor collections! Allows the
attachment of arbitary methods or fields through prototype based classes.
Allows for simple, object oriented two way data binding, as well as for OOP
without losing any of the benefits of reactive Meteor collectoins.  Objects
automatically update their fields whenever minimongo reactively reports that
their corresponding entry has changed. Objects are *not reinstantiated* when
the corresponding collection record updates and therefore can maintain state.

It also acts as a database wrapper over MongoDB and allows for simply
changing fields in a natural way and calling `.update()` to reflect those
changes on the DB. Utilizes 

[![Build Status](https://travis-ci.org/lingz/meteor-reactive-class.svg)](https://travis-ci.org/lingz/meteor-reactive-class)

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
>> Name changed, it is now: My Very Cool Post // Invalidated autorun
console.log(post.name); 
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

Here are the options:

Field               | Default   | Explanation
--------------------|-----------|------------
reactive            | true      | Whether objects reactively update with the collection.
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


## Instantiating Objects

#### Client instantiation
Objects can be created on the client and not linked to any object in the
collection. When ready to insert it into the collection, just call `.put()`.

```javascript
post1 = new Post({name: "My Cool Post"});
post1.put();
```

## Transformations
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

```javascript
post = Post.fetchOne({commentCount: {$gte: 2}});
posts = Post.fetch({commentsCount: {"$gte": 2}});
```

## Reactivity

#### Reactive Queries
As Reactive Classes automatically update their fields, sometimes you don't
want the Collection query itself to be reactive also, as this just causes a
double invalidation and destroys the old object. You may not want reactive
queries for example if you want to maintain state on the object itself, and
you don't want your reference to the object to be destroyed when the query
invalidates. For example:

Reactive Query
```
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

Non-Reactive Query
```
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
>> "My Very Cool Post" // object is reactively updating still
console.log(post.page);
>> 2 // we still have the original object
```

You can disable reactivity on queries by passing `{reactive: false}` to either
the built in collection queries, or to the `.fetch()` and `.fetchOne()`
methods provided by Reactive Class.

Generally, you want to maintain reactivity on queries that are not returning a
specific record and are liable to change (i.e, returning the record with the
highest comment count), and you want to disable it when looking for a specific
record (i.e. with a special id or name).

```javascript
// Queries not targetting specific records might want to retain reactivity
post = PostCollection.findOne({commentCount : {$gte: 2}});
post = Post.fetchOne({commentCount : {$gte: 2}});

// Queries targetting specific records might not want reactivity
post = Post.fetchOne({name: "My Cool Post"}, {reactive: false});
post = PostCollection.findOne("YN2nZmczPsk3jvPuL");

```

Normally `.fetch()`, and `.fetchOne()` are reactive. However, if you pass a
string into `.fetchOne()`, the method will run non-reactively. This is as the
object is reactively updating its fields anyway, so the query running again
would be redundant. For this reason, it is often better to use `.fetchOne()`
when doing queries by _id.

Unfortunately, a weakness of non-reactivite queries, is that when records are
deleted in the database, their corresponding objects still evaluate to truthy
objects. This is as javascript provides no way to programatically delete an
object apart from destroying all references. Thus, we implement a `.exists()`
function, that reactively lets you know if the object is still in the
database. Note that this is only necessary if you are using non-reactive
queries.

```javascript
post = Post.fetchOne("YN2nZmczPsk3jvPuL") // non-reactive
Deps.autorun(function() {
  console.log("Post Existence Status: " + post.exists());
});
```

#### Using set/get
You can use setters and getters to make your access / modifications straight
away. Essentially, this treats every field as if it was a small Session
variable. Sets are *not* reflected on MongoDB, and it is required you call
`.update()` after if you want the changes to reflect there.

```javascript
post = Post.create({name: "My Post"})
Deps.autorun(function() {
  console.log(post.get("name"));
});
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Post"}
post.set("name", "My cool post");
>> {_id: "YN2nZmczPsk3jvPuL", name: "My cool post"}
```

#### Using Depend/Changed explicitly
You can watch an object for change explicitly by calling depend on it
```javascript
Deps.autorun(function() {
  post.depend();
});
post.changed();
```

#### Temporarily enabling/disabling reactivity
And you can also temporarily lock or unlock the object
```javascript
post.lock()
post.unlock()
```

#### Turning off Reactivity
If you don't want reactive objects at all, just instantiate `ReactiveClass()`
with a second parameter, `{reactive: false}`. This will improve performance,
especially if you have a large number of objects. Turning off reactivity is
also a good idea when all objects are instantiated by reactive queries
anyway, as the objects are getting recreated everytime

```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection, {reactive: false});
```

## Interacting With Mongo

#### Taking a local object and putting it into the DB
Use `.put(callback)` to take an object that only exists locally and put it online.
Note that database inserts are asynchronous on the client. Use `.exists()` to
check if the record was successfully inserted. Nevertheless, it will appear as
though the object was inserted instantly, due to Meteor's latency
compensation.

```javascript
post1 = new Post({name: "My Cool Post"});
console.log(PostCollection.findOne({name: "My Cool Post")};
>> undefined

post1.put(function() {
  console.log("Post database status: " + post1.exists())
});
console.log(PostCollection.findOne({name: "My Cool Post")};
>> {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
```

#### Creating an object for the DB
Use `.create(callback)` which has the same signature as `.insert()` to
instantiate a new object and put it into the database straight away, in one
step. This has the same asynchronosity behavior as `.put()`, where it will
appear to complete instantly but is in fact asnychronous until it receives
acknowledgement from the server that the record successfully inserted. Use
`.exists()` to check if it exists in the database.

```javascript
var newPost = PostCollection.create({name: "New Post"});
PostCollection.findOne({name: "New Post"}); 
>> {_id: "YN2nZmczPsk3jvPuL", name: "New Post"}
```

#### Updating local changes to Mongo
Call `update()` to update MongoDB with all current fields. You can also use
`update(query)` to make an update query with the current object.

```javascript
post = new Post.create({name: "Cool Post"});
post.name = "Very Cool Post";
post.update();
PostCollection.findOne({name: "Very Cool Post"})
>> {_id: "YN2nZmczPsk3jvPuL", name: "Very Cool Post"}

post.update({
  $set: {name: "Very Very Cool Post"}
})
console.log(post)
>> {_id: "YN2nZmczPsk3jvPuL", name: "Very Very Cool Post"}
```

#### Forcing a refresh
You can also force Mongo to fetch the latest version of a document with
`.refresh()`.
```javascript
post.refresh();
```

#### Removing an object
You can make an object remove its corresponding record with
`.remove(callback)`. Again, we have the same behavior as was described with
`.put()`, where it will appear to work instantly, but needs to asynchronously
validate the remove with the server. Again use `.exists()` to check if it is
still in the database.

```
post.remove(function() {
  console.log("Post existence status": post.exists());
};
console.log(post.exists());
>> true // note that the remove function is asnychronous on the client.
```

#### Adding / Removing offline fields
Sometimes you want your object to hold fields that do not get put into mongo.
```javascript
Post.addOfflineField(["currentComment", "currentPage"]);
Post.removeOfflineField(["currentPage"]);
post = Post.create({name: "Cool Post"});
post.currentPage = 2;
post.currentComment = 3;
post.update();
console.log(PostCollection.findOne({name: "Cool Post"}));
// {_id: "YN2nZmczPsk3jvPuL", name: "Cool Post", }
console.log(post);
```

