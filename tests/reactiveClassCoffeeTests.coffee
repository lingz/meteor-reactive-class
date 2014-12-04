Tinytest.add "ReactiveClass - Coffee Instantiation", (test) ->
  PostCollection = new Meteor.Collection(null)
  class Post extends ReactiveClass(PostCollection, {coffee: true})
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

  post.name = "My New Post"
  post.put()
  postRecord = PostCollection.findOne()
  test.isFalse(postRecord instanceof Post, "Collection has not been transformed yet")
  Post.setupTransform()
  newPostRecord = PostCollection.findOne()
  test.isTrue(newPostRecord instanceof Post, "Collection has now been transformed")
