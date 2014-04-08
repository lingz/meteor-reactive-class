#Reactive Class for Meteor

Reactive classes with data reactively backed by Meteor collections! Allows the
attachment of arbitary methods or fields through prototype based classes.
Allows for simple, object oriented two way data binding, as well as for OOP
without losing any of the benefits of reactive Meteor collectoins.  Objects
automatically update their fields whenever minimongo reactively reports that
their corresponding entry has changed. Objects are *not reinstantiated* when
the corresponding collection record updates and therefore can maintain state.

It also acts as an ORM over mongoDB and allows for simply changing fields in a
natural way and calling `.update()` to reflect those changes on the DB.

## Example

// Setup
```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection);
Post.prototype.getName = function() {
  return this.name();
}

// Instatiating
post = new Post({name: "My Cool Post"})
post.put(); // insert the post into the database
console.log(post) // {_id: "YN2nZmczPsk3jvPuL", name: "My Cool Post"}

// Reactive access / setting
console.log(post.name); // non-reactive access
Deps.autorun(function() {
  // reactive access
  console.log("Name changed, it is now: " + post.get("Name"));
});

PostCollection.update({name: "My Cool Post"},
  {
    "$set": {name: "My Very Cool Post"}
  }
); 
// Output: Name changed, it is now: My Very Cool Post
// (Computation was invalidated)

// Reactive setters
Post.set("name", "My Very Very Cool Post")
// Output: Name changed, it is now: My Very Very Cool Post
// (Computation was invalidated)
// However, this new change isn't in MongoDB yet

Post.update() // update changes to Mongo
Posts.findOne("YN2nZmczPsk3jvPuL")
// {_id: "YN2nZmczPsk3jvPuL", name: "My Very Very Cool Post"}

// And fields are always up to date!
console.log(post.name); //  "My Very Very Cool Post"
```

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

### Transform method
If you have a very significant existing codebase, and want a way to cheaply
get Reactive Classes everywhere without any refactoring, you can use the
transform field on Meteor collections to make all queries return instances of
your Reactive Class. (Warning: untested).

```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection);
Post.prototype.getName = function() {
  return this.name;
}
PostCollection._transform = Post.transform;
```

### Custom Constructor

```javascript
PostCollection = new Meteor.Collection();
var postConstructor = function(name) {
  console.log("Constructing post with name: " + name);
  this.name = name;
};
Post = new ReactiveClass(postConstructor, PostCollection);
Post.prototype.getName = function() {
  return this.name;
}
```

### Inheritance
Extend an existing class

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
Easy coffeescript extension that fits well with the syntax

```coffeescript
PostCollection = new Meteor.Collection("posts");
class Post extends ReactiveClass(PostCollection)
  constructor: (name) ->
    console.log "Constructing post with name: " + name
    this.name = name
    super() #IMPORTANT! Not optional

  getName: () ->
    return this.name
```

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
example, as the object automatically updates its fields anyway.

```javascript
// Online post
post = Post.fetchOne("YN2nZmczPsk3jvPuL")
console.log(post); // {_id: "xWDrzEvGGDcwmHA6t", name: "My Post About Dogs"}
Posts.update("xWDrzEvGGDcwmHA6t", {
  "$set": {name: "My Post About Cats"}
})
post = Post.fetchOne({commentCount: {$gte: 2}}, {reactive: true})
```

#### Fetching array
Pass in any MongoDB query and get an array of reactively up to date objects.
This is by default a non-reactive method, unless you pass true to it.

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
```

#### Temporarily enabling/disabling reactivity
And you can also temporarily lock or unlock the object
```javascript
post.lock()
post.unlock()
```

#### Turning off Reactivity
If you don't want reactive objects at all, just instantiate `ReactiveClass`
with a second parameter, `{reactive: false}`.


## Interacting With Mongo
```javascript
PostCollection = new Meteor.Collection();
Post = new ReactiveClass(PostCollection, {reactive: false});
```

#### Taking a local object and putting it into the DB
Use `.put()` to take an object that only exists locally and put it online.

```javascript
post1 = new Post({name: "My Cool Post"});
console.log(PostCollection.findOne({name: "My Cool Post")}; // undefined
post1.put(); // Inserts this into PostCollection
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
post.update()
console.log(Posts.findOne({name: "Cool Post"}));
// {_id: "YN2nZmczPsk3jvPuL", name: "Cool Post", }
console.log(post)
```

