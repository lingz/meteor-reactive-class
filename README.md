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
  return this.name();
}
```

Easily create a local object and put it into the DB.
```javascript
post = new Post({name: "My Cool Post"})
console.log(post) // {name: "My Cool Post"}
post.put();
console.log(post) // {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
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
// Name changed, it is now: My Very Cool Post
```

Collection updates automatically invalidate the object and updates all its
fields.
```javascript
PostCollection.update({name: "My Cool Post"},
  {
    "$set": {name: "My Very Cool Post"}
  }
); 
// Name changed, it is now: My Very Cool Post
console.log(post.name); // My Very Cool Post
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

### Note on transformation
Once you've assigned a collection to a class, objects of this class
automatically get cast into that class. You can turn this off by passing
`{transformCollection: false}` to `ReactiveClass(collection, options)`. Note
that if you are using the same collection for multiple classes, it is highly
recommended that you set it to false on every instance, or all your objects
will be of the type of the last class you defined.

## Instantiating Objects

#### Client instantiation
Objects can be created on the client and not linked to any object in the
collection. When ready to insert it into the collection, just call `.put()`.

```javascript
post1 = new Post({name: "My Cool Post"});
console.log(PostCollection.findOne({name: "My Cool Post")}; // undefined
post1.put(); // Inserts this into PostCollection
console.log(post1); // {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
console.log(PostCollection.findOne({name: "My Cool Post")};
// {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
```

#### Fetching from Database
Pass in any MongoDB query and it will fetch the first object and instantiate
it. Will be constantly up to date. This will by default *not be reactive*.
This is to prevent redundant polling and if you are fetching by Id for
example, as the object automatically updates its fields anyway. You can also
pass in a parameter object that you normally find on `collection.find()`.

```javascript
post = Post.fetchOne("YN2nZmczPsk3jvPuL")
console.log(post); // {_id: "xWDrzEvGGDcwmHA6t", name: "My Post About Dogs"}
Posts.update("xWDrzEvGGDcwmHA6t", {
  "$set": {name: "My Post About Cats"}
})
post = Post.fetchOne({commentCount: {$gte: 2}}, {reactive: true})
```

#### Fetching multiple records
Pass in any MongoDB query and get an array of reactively up to date objects.
This is by default a non-reactive method, unless you pass true to it. You can
also pass in a parameter object that you normally find on `collection.find()`.


```javascript
posts = Post.fetch({commentsCount: {"$gte": 2}})
posts = Post.fetch({commentsCount: {"$gte": 2}}, {reactive: true})
```

## Reactivity

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
// {_id: "YN2nZmczPsk3jvPuL", name: "My Post"}
post.set("name", "My cool post");
// {_id: "YN2nZmczPsk3jvPuL", name: "My cool post"}
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
If you don't want reactive objects at all, just instantiate `ReactiveClass`
with a second parameter, `{reactive: false}`. This will improve performance,
especially if you have a large number of objects.

```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection, {reactive: false});
```

## Interacting With Mongo

#### Taking a local object and putting it into the DB
Use `.put()` to take an object that only exists locally and put it online.

```javascript
post1 = new Post({name: "My Cool Post"});
console.log(PostCollection.findOne({name: "My Cool Post")}; // undefined
post1.put();
console.log(post1); // {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}
```

#### Creating an object for the DB
```javascript
Posts.create({name: "New Post"});
Posts.findOne({name: "New Post"}); 
// {_id: "YN2nZmczPsk3jvPuL", name: "New Post"}
```

#### Updating local changes to Mongo
Call `update()` to update MongoDB with all current fields. You can also use
`update(query)` to make an update query with the current object.
```javascript
post = new Post.create({name: "Cool Post"});
post.name = "Very Cool Post";
post.update();
PostCollection.findOne({name: "Very Cool Post"})
// {_id: "YN2nZmczPsk3jvPuL", name: "Very Cool Post"}

post.update({
  $set: {name: "Very Very Cool Post"}
})
console.log(post)
// {_id: "YN2nZmczPsk3jvPuL", name: "Very Very Cool Post"}
```

#### Forcing a refresh
You can also force Mongo to fetch the latest version of a document with
`.refresh()`.
```javascript
post.refresh();
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
console.log(Posts.findOne({name: "Cool Post"}));
// {_id: "YN2nZmczPsk3jvPuL", name: "Cool Post", }
console.log(post);
```

