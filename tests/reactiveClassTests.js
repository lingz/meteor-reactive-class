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
  test.isTrue(comment instanceof Comment, "transfomr should be true by default");
});


