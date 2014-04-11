Tinytest.add "ReactiveClass - Coffee Instantiation", (test) ->
  PostCollection = new Meteor.Collection(null)
  class Post extends ReactiveClass(PostCollection)
    constructor: () ->
      this.good = true
      Post.initialize.call(@)
    getName: () ->
      this.name
  test.equal(Post.collection, PostCollection, "The class should have the right collection")
  test.isTrue(typeof(Post.initialize) == "function", "The class should have the right static context")

  post = new Post()
  test.isTrue(typeof(post.getName) == "function", "Instances should have its own prototype")
  test.isTrue(typeof(post.update) == "function", "Instances should have inherited the Reactive Class prototype")
  test.isTrue(typeof(post.initialize) == "undefined", "Instances should not have the static context")
  test.isTrue(post instanceof Post, "Instances should be of the right class")

  class BadPost extends ReactiveClass(PostCollection)
    constructor: () ->
      this.good = true
    getName: () ->
      this.name

  post = new BadPost()
  test.isFalse(post._reactive, "Without calling initialize should give a bad class")

