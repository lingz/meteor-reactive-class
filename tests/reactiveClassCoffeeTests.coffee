Tinytest.add "ReactiveClass - Coffee Instantiation", (test) ->
  PostCollection = new Meteor.Collection(null)
  class Post extends ReactiveClass(PostCollection)
    constructor: () ->
      this.good = true
      console.log(Post)
      Post.initialize.call(@)
    getName: () ->
      this.name
  # it took the right collection
  test.equal(Post.collection, PostCollection)
  # it has static methods
  test.isTrue(typeof(Post.initialize) == "function")

  post = new Post()
  # it has its own prototype
  test.isTrue(typeof(post.getName) == "function")
  # inherited ReactiveClass prototype
  test.isTrue(typeof(post.update) == "function")
  # it does not have static methods
  test.isTrue(typeof(post.initialize) == "undefined")
  test.isTrue(post._reactive, "This is good instantiation")

  class BadPost extends ReactiveClass(PostCollection)
    constructor: () ->
      this.good = true
    getName: () ->
      this.name

  post = new BadPost()
  test.isFalse(post._reactive, "This is bad instantiation")

