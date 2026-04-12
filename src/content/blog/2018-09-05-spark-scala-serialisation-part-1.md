---
draft: false
title: "Serialisation challenges with Spark and Scala"
snippet: ""
image: { src: "../../assets/scala-spark-1.webp", alt: "" }
publishDate: "2018-09-05 12:00"
category: "Technology"
author: "Tim Gent"
tags: [scala, spark]
---

[Article originally posted here](https://medium.com/onzo-tech/serialization-challenges-with-spark-and-scala-a2287cd51c54)

Apache Spark is a great tool for high performance, high volume data analytics. When working with Spark and Scala you will often find that your objects will need to be serialized so they can be sent to the Spark worker nodes. Whilst the rules for serialization seem fairly simple, interpreting them in a complex code base can be less than straightforward! If you get things wrong then far more than you intended can end up being Serialized, and this can easily lead to run time exceptions where the objects aren’t serializable.

This post will talk through a number of motivating examples to help explain what will be serialized and why. There will shortly be a follow up post to work through a much more complex example too if you would like a challenge!

## Serialization Rules

Before we get into examples let’s explore the basic rules around serialization with respect to Spark code.

### When will objects need to be Serialized?

When you perform a function on an RDD (Spark’s Resilient Distributed Dataset), or on anything that is an abstraction on top of this (e.g. Dataframes, Datasets), it is common that this function will need to be serialized so it can be sent to each worker node to execute on its segment of the data.

### What gets Serialized?

The rules for what is Serialized are the same as in Java more generally — only objects can be serialized.

The function being passed to map (or similar Spark RDD function) itself will need to be Serialized (note this function is itself an object). If references to other objects are made within this function then those objects will also need to be serialized. The whole of these objects will be serialized, even when accessing just one of their fields.

## Examples

Examples including code and explanations follow, though I strongly encourage you to try running the examples yourself and trying to figure out why each one works or doesn’t work — you’ll learn much more this way! All the examples along with explanations can be found on ONZO’s Github here.

For each of these examples assume we have a testRdd containing Integers.

```scala
val testRdd: RDD[Int]
```

Basic(ish) Examples

We’ll start with some basic examples that draw out the key principles of Serialization in Spark.

### 1 — basic spark map

```scala
object Example {
  def myFunc = testRdd.map(\_ + 1)
}
```

**PASSES**

A very simple example — in this case the only thing that will be serialized is a Function1 object which has an apply method that adds 1 to it’s input. The Example object won’t be serialized.

### 2 — spark map with external variable

```scala
object Example {
  val num = 1
  def myFunc = testRdd.map(\_ + num)
}
```

**FAILS**

Very similar to the above, but this time within our anonymous function we’re accessing the num value. Therefore the whole of the containing Example object will need to be serialized, which will actually fail because it isn’t serializable.

### 3 — spark map with external variable — the first way to fix it

```scala
object Example extends Serializable {
  val num = 1
  def myFunc = testRdd.map(\_ + num)
}
```

**PASSES**

One solution people often jump to is to make the object in question Serializable. It works, but may not be desirable as ideally we want to be serializing as little as possible.

### 4 — spark map with external variable — a flawed way to fix it

```scala
object Example {
  val num = 1
  def myFunc = {
    lazy val enclosedNum = num
    testRdd.map(\_ + enclosedNum)
  }
}
```

**FAILS**

In this case we create an enclosedNum value inside the scope of myFunc — when this is referenced it should stop trying to serialize the whole object because it can access everything required the scope of myFunc. However because enclosedNum is a lazy val this still won’t work, as it still requires knowledge of num and hence will still try to serialize the whole of the Example object.

### 5 — spark map with external variable — properly fixed

```scala
object Example {
  val num = 1
  def myFunc = {
    val enclosedNum = num
    testRdd.map(\_ + enclosedNum)
  }
}
```

**PASSES**

Similar to the previous example, but this time with enclosedNum being a val, which fixes the previous issue.
Upping the difficulty — examples with nested objects

The same principles apply in the following examples, just with the added complexity of a nested object.

### 6 — nested objects, a simple example

```scala
object Example {
  val outerNum = 1
  object NestedExample extends Serializable {
    val innerNum = 10
    def myFunc = testRdd.map(\_ + innerNum)
  }
}
```

**PASSES**

A slightly more complex example but with the same principles. Here innerNum is being referenced by the map function. This triggers serialization of the whole of the NestedExample object. However this is fine because it extends Serializable. You could use the same enclosing trick as before to stop the serialization of the NestedExample object too.

### 7 — nested objects gone wrong

```scala
object Example {
  val outerNum = 1
  object NestedExample extends Serializable {
    val innerNum = 10
    def myFunc = testRdd.map(\_ + outerNum)
  }
}
```

**FAILS**
In this case outerNum is being referenced inside the map function. This means the whole Example object would have to be serialized, which will fail as it isn't Serializable.

### 8 — nested objects, using enclosing in the inner object

```scala
object Example {
  val outerNum = 1
  object NestedExample extends Serializable {
    val innerNum = 10
    val encOuterNum = outerNum
    def myFunc = testRdd.map(\_ + encOuterNum)
  }
}
```

**PASSES**

In this example we have fixed the previous issue by providing encOuterNum. Now the map references only values in the NestedExample object, which can be serialized.
What’s next?

Stay tuned for the next post which will walk through a much more complex example, truly testing your understanding of serialization in Spark.

New post now available here!
<https://medium.com/onzo-tech/serialization-challenges-with-spark-and-scala-part-2-now-for-something-really-challenging-bd0f391bd142>
