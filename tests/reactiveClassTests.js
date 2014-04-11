Tinytest.add("ReactiveClass - Instantiation", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.prototype.instaceMethod = function() {
    return this.name;
  };

  test.equal(Post.collection, PostCollection, "it took the right collection");
  test.isTrue(typeof(Post.initialize) === "function", "it has static methods");

  var post = new Post({name: "My New Post"});

  test.isTrue(typeof(post.instaceMethod) === "function", "it has its own prototype");
  test.isTrue(typeof(post.update) === "function", "it has the ReactiveClass prototype");
  test.isTrue(typeof(post.initialize) === "undefined", "it does not have static methods");
  test.equal(post.name, "My New Post", "constructor properly took fields");
  test.equal(post.name, post.instaceMethod(), "prototype methods have the right context");
});

Tinytest.add("ReactiveClass - Inheritance", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = function(name) {
    this.name = name;
  };
  Post.prototype.instanceMethod = function() {
    return this.name;
  };
  Post.staticMethod = function() {
    return this.field;
  };
  Post.field = "field";

  var ReactivePost = ReactiveClass(PostCollection).extend(Post);
  test.equal(ReactivePost.collection, PostCollection, "it took the right collection");
  test.isTrue(typeof(ReactivePost.initialize) === "function", "it has ReactiveClass static methods");
  test.isTrue(typeof(ReactivePost.staticMethod) === "function", "it has its own static methods");
  test.equal(ReactivePost.field, Post.field, "all fields copied correctly");
  test.equal(ReactivePost.field, ReactivePost.staticMethod(), "static context is correct");

  var post = new ReactivePost({name: "My New Post"});
  test.isTrue(typeof(post.instanceMethod) === "function", "it has its own prototype");
  test.isTrue(typeof(post.update) === "function", "it has the ReactiveClass prototype");
  test.isTrue(typeof(post.initialize) === "undefined", "it does not have static methods");
  test.equal(post.name, post.instanceMethod(), "prototype methods have the right context");

  PostWithComments = function (commentLimit) {
    this.commentLimit = commentLimit;
  };

  ReactivePostWithComments = ReactivePost.extend(PostWithComments);

});

Tinytest.add("ReactiveClass - Transform", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {transformCollection: false});
  PostCollection.insert({name: "My New Post"});

  var post = PostCollection.findOne();
  test.isFalse(post instanceof Post, "When transform is true, records should not be instances of the class");

  var PostAutoTransform = new ReactiveClass(PostCollection, {transformCollection: true});
  var postTransformed = PostCollection.findOne();
  test.isTrue(postTransformed instanceof PostAutoTransform, "When transform is false, records should be instances of the class");

  var CommentCollection = new Meteor.Collection(null);
  var Comment = new ReactiveClass(CommentCollection);
  CommentCollection.insert({name: "My New Comment"});

  var comment = CommentCollection.findOne();
  test.isTrue(comment instanceof Comment, "transform should be true by default");
});

Tinytest.add("ReactiveClass - Client Instantiation", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {transformCollection: false});

  var post = new Post({name: "My Cool Post"});
  test.isTrue(PostCollection.find().count() === 0, "locally instantiated objects should not automatically go into the database");
  test.isFalse(_.has(post, "_id"), "locally instantiated objects should not automatically have an _id");

  post.put(); 
  test.isTrue(PostCollection.find().count() === 1, "locally put objects should be in the database");
  test.isTrue(_.has(post, "_id"), "local put objects should have an _id");
  test.isTrue(PostCollection.findOne().name == post.name, "locally put objects should have their fields correctly inserted");
});

Tinytest.add("ReactiveClass - Fetching from Database", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {transformCollection: false});
  var postId = PostCollection.insert({name: "My Cool Post"});

  var post = Post.fetchOne(postId);
  test.isTrue(post, "Should be able to fetch by Id");
  test.isTrue(post instanceof Post, "Id query should be fetch");

  var queriedPost = Post.fetchOne({name: "My Cool Post"});
  test.isTrue(queriedPost, "Should be also able to fetch by query");

});

Tinytest.add("ReactiveClass - Creating an object for Mongo", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);

  var newPost = Post.create({name: "New Post"});

  test.isTrue(_.has(newPost, "_id", "name"), "The created object should have its own fields and an _id");
  test.isTrue(PostCollection.findOne({name: "New Post"}), "The created object should have a record in mongo."); 

});

Tinytest.add("ReactiveClass - Updating objects on Mongo", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);

  var post = Post.create({name: "Cool Post"});
  post.name = "Very Cool Post";
  post.update();

  test.isTrue(PostCollection.findOne({name: "Very Cool Post"}), "Mongo should have found the updated object");
  test.isFalse(PostCollection.findOne({name: "Cool Post"}), "Mongo should not find the stale object");

  post.update({
    $set: {name: "Very Very Cool Post"}
  });

  test.isTrue(post.name == "Very Very Cool Post", "The object should have the updated state");
  test.isTrue(PostCollection.findOne({name: "Very Very Cool Post"}), "Mongo should have the updated object");
});

Tinytest.add("ReactiveClass - Removing objects on Mongo", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  var post = Post.create({name: "Cool Post"});
  post.remove();

  test.isTrue(PostCollection.find().count() === 0, "Mongo should no longer have the removed object");
});

Tinytest.add("ReactiveClass - Refresh method", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {reactive: false});
  var post = Post.create({name: "Cool Post"});

  post.update({
    $set: {name: "Very Cool Post"}
  });
  post.refresh();

  test.isTrue(post.name == "Very Cool Post", "An update should make the object be consistent with the database");
});

Tinytest.add("ReactiveClass - Offline fields", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.addOfflineFields(["page", "counter"]);
  var post = Post.create({name: "Cool Post", counter: 5});


  post.page = 3;
  post.update();

  var postRecord = PostCollection.findOne();

  test.isFalse(_.has(postRecord, "page"), "The record should not have the page field");
  test.isFalse(_.has(postRecord, "counter"), "The record should not have the counter field");

  Post.removeOfflineFields(["page", "counter"]);
  post.update();

  var newPostRecord = PostCollection.findOne();
  test.isTrue(_.has(newPostRecord, "page"), "The record should not have the page field");
  test.isTrue(_.has(newPostRecord, "counter"), "The record should not have the counter field");
});

Tinytest.addAsync("ReactiveClass - Reactive Queries", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.create({name: "My Cool Post", tag: 5});
  var post;
  var first = true;
  var compCounter = 0;
  Deps.autorun(function() {
    post = PostCollection.findOne({tag: 5});
  });
  var oldPost = post;

  post.page = 3;

  PostCollection.update(post._id, {
    $set: {
      name: "My Very Cool Post"
    }
  });
  Meteor.setTimeout(function() {
    test.isTrue(post != oldPost, "The reactive query should have overwritten our reference to the old object");
    test.isTrue(post.name == "My Very Cool Post", "We should have the latest version of the post");
    test.isFalse(post.page, "The state we attached to post should have dissapeared");
    next();
  }, 0);
});

Tinytest.addAsync("ReactiveClass - Non-Reactive Queries", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.create({name: "My Cool Post", tag: 5});
  var post;
  Deps.autorun(function() {
    post = PostCollection.findOne({tag: 5}, {reactive: false});
  });
  post.page = 3;

  var oldPost = post;

  PostCollection.update(post._id, {
    $set: {
      name: "My Very Cool Post"
    }
  });
  Meteor.setTimeout(function() {
    test.isTrue(post == oldPost, "The reactive query should not have overwritten our reference to the old object");
    test.isTrue(post.name == "My Very Cool Post", "We should have the latest version of the post");
    test.isTrue(post.page, "The state we attached to post should have remained");
    next();
  }, 0);
});

Tinytest.addAsync("ReactiveClass - Setters and Getters", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  post = Post.create({name: "My Cool Post", tag: 5});

  var count = 0;
  var finalVal;
  Deps.autorun(function() {
    finalVal = post.get("name");
    count++;
  });

  test.isTrue(finalVal == "My Cool Post", "Deps should begin running and initially set the finalVal");
  test.isTrue(count == 1, "Deps should run once when defined");

  post.name = "My Not So Cool Post";
  test.isFalse(finalVal == "My Very Cool Post", "Deps should not update finalVal on regular set");
  test.isFalse(count == 2, "Deps should not invalidate when during regular assignment");

  post.set("name", "My Very Cool Post");
  test.isTrue(finalVal == "My Very Cool Post", "Deps should begin keep finalVal up to date");
  test.isTrue(count == 2, "Deps should run again when invalidated");
  Meteor.setTimeout(function() {
    test.isTrue(finalVal == "My Very Cool Post", "Deps should begin keep finalVal up to date");
    test.isTrue(count == 2, "Deps should run again when invalidated");
    next();
  }, 0);
});
