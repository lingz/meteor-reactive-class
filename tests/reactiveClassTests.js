Tinytest.add("ReactiveClass - Instantiation", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.prototype.instaceMethod = function() {
    return this.name;
  };

  test.equal(Post.collection, PostCollection, "The class should have took the right collection");
  test.isTrue(typeof(Post.initialize) === "function", "The class should have the right static context");

  var post = new Post({name: "My New Post"});

  test.isTrue(typeof(post.instaceMethod) === "function", "Instances should have their own prototype");
  test.isTrue(typeof(post.update) === "function", "Instances should have the ReactiveClass prototype");
  test.isTrue(typeof(post.initialize) === "undefined", "Instances should not have static methods");
  test.equal(post.name, "My New Post", "Instances should properly construct with the right fields fields");
  test.equal(post.name, post.instaceMethod(), "Instance methods should have the right context");
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
  test.equal(ReactivePost.collection, PostCollection, "The class should take the right collection");
  test.isTrue(typeof(ReactivePost.initialize) === "function", "The class should have ReactiveClass static methods");
  test.isTrue(typeof(ReactivePost.staticMethod) === "function", "The class should have its own static methods");
  test.equal(ReactivePost.field, Post.field, "Static fields should have copied copied correctly");
  test.equal(ReactivePost.field, ReactivePost.staticMethod(), "The static context should becorrect");

  var post = new ReactivePost({name: "My New Post"});
  test.isTrue(typeof(post.instanceMethod) === "function", "Instaces should have their own prototype");
  test.isTrue(typeof(post.update) === "function", "Instances should have the ReactiveClass prototype");
  test.isTrue(typeof(post.initialize) === "undefined", "Instaces should not have static methods");
  test.equal(post.name, post.instanceMethod(), "Instance methods have the right context");

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
Tinytest.addAsync("ReactiveClass - Polling objects on Mongo", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);

  var post = Post.create({name: "Cool Post"});
  post.poll();

  var lastName;
  Deps.autorun(function() {
    lastName = post.get("name");
  });

  test.isTrue(lastName == "Cool Post", "Dep should have already run once");

  PostCollection.update(post._id, {
    $set: {name: "Very Cool Post"}
  });

  Meteor.setTimeout(function() {
    test.isTrue(lastName == "Very Cool Post", "Dep should have run again due to the DB update");
    post.stopPoll();
    PostCollection.update(post._id, {
      $set: {name: "Very Very Cool Post"}
    });
    Meteor.setTimeout(function() {
      test.isFalse(lastName == "Very Very Cool Post", "Dep should not have run again, as the polling has been stopped");
      next();
    }, 0);
  }, 0);

});

Tinytest.addAsync("ReactiveClass - Removing objects on Mongo", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  var post = Post.create({name: "Cool Post"}, function() {
    test.isTrue(post.exists(), "The object currently exists");
    post.remove();

    test.isTrue(PostCollection.find().count() === 0, "Mongo should no longer have the removed object");
    test.isFalse(post.exists(), "The object should not still exist at this point");
    Meteor.setTimeout(function() {
      test.isFalse(post.exists(), "The object should not still exist");
      next();
    }, 0);
  });
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

Tinytest.add("ReactiveClass - Do Not Update fields", function(test) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.addDoNotUpdateFields(["counter"]);
  var post = Post.create({name: "Cool Post", counter: 5});

  post.counter = 7;
  post.update();

  var postRecord = PostCollection.findOne();

  test.isFalse(_.has(postRecord, "page"), "The record should not have the page field");
  test.isTrue(_.has(postRecord, "counter"), "The record should have the counter field");
  test.isTrue(postRecord.counter != 7, "The record should not have updated the counter field");

  Post.removeDoNotUpdateFields("counter");
  post.counter = 7;
  post.update();
  var newPostRecord = PostCollection.findOne();
  test.isTrue(newPostRecord.counter == 7,
              "The record should now have updated the counter field");
});

Tinytest.addAsync("ReactiveClass - Reactive Queries", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  Post.create({name: "My Cool Post", tag: 5});
  var post;
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
    test.isFalse(post.name == "My Very Cool Post", "We should not have the latest version of the post");
    test.isTrue(post.page, "The state we attached to post should have remained");
    next();
  }, 0);
});

Tinytest.addAsync("ReactiveClass - Setters and Getters", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  var post = new Post({name: "My Cool Post"});

  var count = 0;
  var finalVal;
  Deps.autorun(function() {
    finalVal = post.get("name");
    count++;
  });

  test.isTrue(finalVal == "My Cool Post", "Deps should begin running and initially set the finalVal");
  test.isTrue(count == 1, "Deps should run once when defined");

  post.name = "My Not So Cool Post";
  test.isFalse(finalVal == "My Not So Cool Post", "Deps should not update finalVal on regular set");
  test.isFalse(count == 2, "Deps should not invalidate when during regular assignment");

  post.set("name", "My Very Cool Post");
  Meteor.setTimeout(function() {
    test.isTrue(finalVal == "My Very Cool Post", "Deps should keep finalVal up to date");
    test.isTrue(count == 2, "Deps should run again when invalidated");
    next();
  }, 0);
});

Tinytest.addAsync("ReactiveClass - Depend and Changed", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  var post = new Post({name: "My Cool Post"});

  var count = 0;
  var finalVal;
  Deps.autorun(function() {
    finalVal = post.name;
    post.depend();
    count++;
  });

  post.name = "My Very Cool Post";
  post.changed();
  Meteor.setTimeout(function() {
    test.isTrue(finalVal == "My Very Cool Post", "Deps should keep finalVal up to date");
    test.isTrue(count == 2, "Deps should run again when invalidated");
    next();
  }, 0);
});

Tinytest.addAsync("ReactiveClass - Locking and Unlocking", function(test, next) {
  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection);
  var post = new Post({name: "My Cool Post"});

  var count = 0;
  var finalVal;
  post.lock();
  Deps.autorun(function() {
    finalVal = post.get("name");
    count++;
  });

  post.set("name", "My Not So Cool Post");
  Meteor.setTimeout(function() {
    test.isTrue(finalVal == "My Cool Post", "Deps should not run only once finalVal when locked");
    test.isTrue(count == 1, "Deps should have run only once when locked");
    post.unlock();

    post.set("name", "My Very Cool Post");
    Meteor.setTimeout(function() {
      test.isTrue(finalVal == "My Very Cool Post", "Deps should now keep finalVal up to date since unlocked");
      test.isTrue(count == 2, "Deps should have run twice now that it has been unlocked");
      next();
    }, 0);
  }, 0);
});

Tinytest.add("ReactiveClass - Expanding properties via options array", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: [{
      idField: 'categoryIds',
      objField: 'categories',
      collection: CategoryCollection
    }]
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryIds: [category._id]});

  test.isTrue(_.has(post, "categories"), "The created post should have the new field categories");
  test.isTrue(post.categories[0]._id == category._id, "The _id of the first element in the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Expanding properties via options object", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'categoryIds',
      objField: 'categories',
      collection: CategoryCollection
    }
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryIds: [category._id]});

  test.isTrue(_.has(post, "categories"), "The created post should have the new field categories");
  test.isTrue(post.categories[0]._id == category._id, "The _id of the first element in the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Expanding object instead of array", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'categoryId',
      objField: 'category',
      collection: CategoryCollection
    }
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryId: category._id});

  test.isTrue(_.has(post, "category"), "The created post should have the new field category");
  test.isTrue(post.category._id == category._id, "The _id of the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Expanding from subobject", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'props.categoryIds',
      objField: 'categories',
      collection: CategoryCollection
    }
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", props: {categoryIds: [category._id]}});

  test.isTrue(_.has(post, "categories"), "The created post should have the new field categories");
  test.isTrue(post.categories[0]._id == category._id, "The _id of the first element in the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Expanding to subobject with array", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'categoryIds',
      objField: 'props.categories',
      collection: CategoryCollection
    }
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryIds: [category._id]});

  test.isTrue(_.has(post, "props"), "The created post should have the new field props");
  test.isTrue(_.has(post.props, "categories"), "The object post.props should have the field categories");
  test.isTrue(post.props.categories[0]._id == category._id, "The _id of the first element in the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Expanding to subobject", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'categoryIds',
      objField: 'props.category',
      collection: CategoryCollection
    }
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryId: category._id});

  test.isTrue(_.has(post, "props"), "The created post should have the new field props");
  test.isTrue(_.has(post.props, "category"), "The object post.props should have the field categories");
  test.isTrue(post.props.category._id == category._id, "The _id of the first element in the new field should be equal to the one in the category object.");

});

Tinytest.add("ReactiveClass - Don\'t save expanded object", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: {
      idField: 'categoryId',
      objField: 'props.category',
      collection: CategoryCollection
    },
    transformCollection: false
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryId: category._id});
  post.update()

  var post2 = Post.create({name: 'New Post 2', categoryId: category._id, props: {test: true}});
  post2.update()

  var newPost = PostCollection.findOne(post._id);
  var newPost2 = PostCollection.findOne(post2._id);

  test.isFalse(_.has(newPost, "props"), "The first fetched post shouldn't have the field props");
  test.isTrue(_.has(newPost2, "props"), "The second fetched post should have the field props");
  test.isFalse(_.has(newPost2.props, "category"), "The second fetched post shouldn't have the field props.category");

});

Tinytest.add("ReactiveClass - Don\'t save expanded object if initialized with array", function(test) {
  var CategoryCollection = new Meteor.Collection(null);
  var Category = new ReactiveClass(CategoryCollection);

  var PostCollection = new Meteor.Collection(null);
  var Post = new ReactiveClass(PostCollection, {
    expand: [{
      idField: 'categoryId',
      objField: 'category',
      collection: CategoryCollection
    }],
    transformCollection: false
  });

  var category = Category.create({'name': 'General'});
  var post = Post.create({name: "New Post", categoryId: category._id});
  post.update()

  var newPost = PostCollection.findOne(post._id);

  test.isFalse(_.has(newPost, "category"), "The fetched post shouldn't have the field category");

});
