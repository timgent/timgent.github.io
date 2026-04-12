---
draft: false
title: "Serialisation challenges with Spark and Scala — Part 2 — Now for something really challenging…"
snippet: "A deeper dive into serialization with Spark and Scala, working through a complex example step by step."
image: { src: "../../assets/scala-spark-1.webp", alt: "" }
publishDate: "2018-09-19 12:00"
category: "Technology"
author: "Tim Gent"
tags: [scala, spark]
---

[Article originally posted here](https://medium.com/onzo-tech/serialization-challenges-with-spark-and-scala-part-2-now-for-something-really-challenging-bd0f391bd142)

Following on from [the introductory post on serialization with spark](/blog/2018-09-05-spark-scala-serialisation-part-1), this post gets right into the thick of it with a tricky example of serialization with Spark. I highly recommend attempting to get this working yourself first, you'll learn a lot!

Each example steps through some ways you may try to debug the problems, eventually resulting in a working solution. Once again the code samples can be found on [ONZO's Github](https://github.com/onzo-com/spark-demo/), and the numbering on this article should match up with the code there :)

### 9 — base example

```scala
object Example {

  class WithFunction(val num: Int) {
    def plusOne(num2: Int) = num2 + num
  }

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc =
      testRdd.map(reduceInts)
  }

  def run = {
    val withFunction = new WithFunction(1)
    val withSparkMap = new WithSparkMap(withFunction.plusOne)
    withSparkMap.myFunc
  }
}
```

**FAILS**

Now for some practice! This example is relatively complex and needs a few changes to work successfully. Can you figure out what they are? Kudos if so! The next few examples walk through a solution step by step, and some things you may try.

### 10 — make classes serializable

```scala
object Example {

  class WithFunction(val num: Int) extends Serializable {
    def plusOne(num2: Int) = num2 + num
  }

  class WithSparkMap(reduceInts: Int => Int) extends Serializable {
    def myFunc =
      testRdd.map(reduceInts).collect.toList shouldBe List(2, 3, 4)
  }

  def run = {
    val withFunction = new WithFunction(1)
    val withSparkMap = new WithSparkMap(withFunction.plusOne)
    withSparkMap.myFunc
  }
}
```

**FAILS**

One approach to serialization issues can be to make everything Serializable. However in this case you will find it doesn't solve the issue. You'll find it easier (but not that easy..!) to spot why if you look at the complete examples. It's because when trying to serialize the classes it will find references to `testRdd` and also the `shouldBe` method. This will trigger serialization of the test class ([you can see the full code in Github](https://github.com/onzo-com/spark-demo/blob/master/src/test/scala/sparky/SparkSerializationSpec.scala#L116)) that contains these, and the test class is not serializable.

### 11a — use anon function

```scala
object Example {
  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      testRdd
        .map (e => reduceInts(e))
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap(num => num + 1)
    withSparkMap.myFunc
  }
}
```

**FAILS**

In order to debug this you might try simplifying things by replacing the WithFunction class with a simple anonymous function. However in this case we still have a failure, can you spot the issue now?

### 11b — use anon function, with enclosing

```scala
object Example {
  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap(num => num + 1)
    withSparkMap.myFunc
  }
}
```

**PASSES**

Did you spot it? By enclosing the reduceInts method the map function can now access everything it needs in that one closure, no need to serialize the other classes!

### 12a — use function with def

```scala
object Example {
  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    def addOne(num: Int) = num + 1
    val withSparkMap = new WithSparkMap(num => addOne(num))
    withSparkMap.myFunc
  }
}
```

**FAILS**

Taking small steps, we now replace the anonymous function with a function declared with a def. Again you will find this fails, but seeing why isn't easy. It is because of the intricacies of how `def` works. Essentially a method defined with def contains an implicit reference to `this`, which in this case is an object which can't be serialized. You can find out more about [the differences between def and val here](https://alvinalexander.com/scala/fp-book-diffs-val-def-scala-functions).

### 12b — use function with val

```scala
object Example {
  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val addOne = (num: Int) => num + 1
    val withSparkMap = new WithSparkMap(num => addOne(num))
    withSparkMap.myFunc
  }
}
```

**PASSES**

Declaring the method with `val` works. A `val` method equates to a Function1 object, which is serializable, and doesn't contain an implicit reference to `this`, stopping the attempted serialization of the `Example` object.

### 12c — use function with val explained part 1

```scala
object Example {
  val one = 1

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val addOne = (num: Int) => num + one
    val withSparkMap = new WithSparkMap(num => addOne(num))
    withSparkMap.myFunc
  }
}
```

**FAILS**

This example serves to illustrate the point more clearly. Here the `addOne` function references the `one` value. As we saw earlier this will cause the whole `Example` object to be serialized, which will fail.

**BONUS POINTS**

One helpful experiment to try here is to resolve this by making the `Example` object serializable.
You will note that you still get a serialization error. Can you see why? There are actually 2 reasons:

1. `testRdd` is referenced inside the WithSparkMap class, leading to the whole Spec trying to be serialized (please see Github link for full code which will explain this more!)
2. The `shouldBe` method is also referenced, again leading to the whole Spec trying to be serialized

### 12d — use function with val explained part 2

```scala
object Example {
  val one = 1

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val oneEnc = one
    val addOne = (num: Int) => num + oneEnc
    val withSparkMap = new WithSparkMap(num => addOne(num))
    withSparkMap.myFunc
  }
}
```

**PASSES**

As above, the best way to fix the issue is to reference values only in the more immediate scope. Here we have added `oneEnc`, which prevents the serialization of the whole `Example` object.

### 13 — back to the problem, no class params

```scala
object Example {
  class WithFunction {
    val plusOne = (num2: Int) => num2 + 1
  }

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap((new WithFunction).plusOne)
    withSparkMap.myFunc
  }
}
```

**PASSES**

Coming back from the issue we originally had, now we understand a little more let's introduce our WithFunction class back in. To simplify things we've taken out the constructor parameter here. We're also using a val for the method rather than a def. No serialization issues now!

### 14 — back to the problem, with class params

```scala
object Example {
  class WithFunction(val num: Int) {
    val plusOne = (num2: Int) => num2 + num
  }

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap(new WithFunction(1).plusOne)
    withSparkMap.myFunc
  }
}
```

**FAILS**

We've now added back in the class params. Can you spot why this fails? The `plusOne` function references `num`, outside of the immediate scope, again causing more objects to be serialized which is failing.

### 15a — back to the problem, with class params, and enclosing

```scala
object Example {
  class WithFunction(val num: Int) extends Serializable {
    val plusOne = {
      val encNum = num
      num2: Int => num2 + encNum
    }
  }

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap(new WithFunction(1).plusOne)
    withSparkMap.myFunc
  }
}
```

**PASSES**

This is now a simple fix, and we can enclose the `num` value with `encNum` which resolves the last of our serialization issues. Finally, this is a complete working example that is equivalent to our first implementation that failed!

### 15b — adding some complexity e.g.7b — testing understanding

```scala
object Example {
  class WithFunction(val num: Int) {
    val plusOne = { num2: Int =>
      {
        val encNum = num
        num2 + encNum
      }
    }
  }

  class WithSparkMap(reduceInts: Int => Int) {
    def myFunc = {
      val reduceIntsEnc = reduceInts
      testRdd
        .map { e =>
          reduceIntsEnc(e)
        }
        .collect
        .toList shouldBe List(2, 3, 4)
    }
  }

  def run = {
    val withSparkMap = new WithSparkMap(new WithFunction(1).plusOne)
    withSparkMap.myFunc
  }
}
```

**FAILS**

One more failing example! Can you see why the above fails?

The issue is that `encNum` won't be evaluated until `plusOne` is actually called, effectively within the map function. At this point then the `num` value will need to be accessed, causing additional serialization of the containing object and the failure here.

## Conclusion

Hopefully these examples have made a little clearer how serialization of functions works with Spark and Scala, good luck with your Spark serialization challenges!
