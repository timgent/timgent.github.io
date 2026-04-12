---
draft: false
title: "How to speed up your Elixir compile times (part 1) — understanding Elixir compilation"
snippet: "Struggling with slow Elixir compile times? Learn why changing one file causes dozens to recompile, and understand compile-time vs runtime dependencies."
image:
  {
    src: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?&fit=crop&w=430&h=240",
    alt: "Code on a screen",
  }
publishDate: "2022-08-17 00:00"
category: "Technology"
author: "Tim Gent"
tags: [elixir, compilation, performance]
---

Struggling with slow Elixir compile times? If you're working in a large Elixir codebase you may find that the compile times start to suffer. You change just a single file and re-run your test, but it compiles tens of files and takes ages. Part 1 of these posts will explain why this happens. Part 2 will help you check your understanding, and part 3 will provide a practical guide for reducing your incremental compile times.

## Why does Elixir need to compile so many files when I change just one?

### Run-time vs compile time

When you write Elixir code some of it will be run at compile-time, and some will be run at runtime. For example if you use module attributes they are evaluated at compile time, and the output is written into the `.beam` files that the compiler produces. For example this:

```elixir
defmodule Dinner do
  @dinner_steps ["make food", "make drinks"]
  def dinner_steps, do: @dinner_steps
end
```

Will be evaluated, so the code that would be at runtime would be just:

```elixir
defmodule Dinner do
  def dinner_steps, do: ["make food", "make drinks"]
end
```

Of course this would be a `.beam` file rather than Elixir code, but you get the point. In this example `Dinner` doesn't depend on any other module, so the only time it ever needs to be recompiled is if this file itself is modified.

### Compile-time dependencies

But what if our module attribute depended on another module?

```elixir
defmodule Dinner do
  @dinner_steps Food.make() ++ Drinks.make()
  def dinner_steps, do: @dinner_steps
end
```

Now if the `Food` or `Drinks` modules change it could change the `.beam` file produced for `Dinner`! Also, this applies even if you change something other than the `make` function in `Food` or `Drink` — the Elixir compiler only looks at file level dependencies and file level changes. So now if we modify `Food` it will cause both `Food` and `Dinner` to be recompiled. We say that `Dinner` has a compile-time dependency on both `Food` and `Drinks`.

### Transitive compile-time dependencies

Now imagine the `Food` module calls on another module `MainCourse`. We say that `Food` has a runtime dependency on `MainCourse`.

```elixir
defmodule Food do
  def make, do: MainCourse.make()
end
```

Now if `MainCourse` changes that may impact what the `Dinner` module gets compiled to, so `Dinner` will be recompiled every time `MainCourse` changes too. We can say `Dinner` has a transitive compile-time dependency on `MainCourse`. To summarise the dependency tree now looks like:

![Dinner depends on food and drink (compile-time). Food depends on Main Course (runtime). Dinner has a transitive compile-time dependency on Main Course](https://miro.medium.com/v2/resize:fit:1400/1*IoeDU5_8Z1LcFx6fAoNMtw.png)

**As you can imagine, the more compile-time or transitive compile-time dependencies a file has, the more likely it will need to be recompiled when other files change. If you have too many then even changing a single file can cause 10s or hundreds of other files to get recompiled, slowing you down.**

## The plot thickens — circular dependencies

Now imagine we wrote some code like this in our `MainCourse` module:

```elixir
defmodule MainCourse do
  def make, do: Dinner.microwave("pot noodle")
end
```

Now `MainCourse` has a runtime dependency on `Dinner` and we've created a circular dependency. This is bad!

![Dinner depends on food and drink (compile-time). Food depends on MainCourse (runtime). Dinner has a transitive compile-time dependency on MainCourse. MainCourse has a runtime dependency on Dinner](https://miro.medium.com/v2/resize:fit:1400/1*Z70nGGPzJ5XSYX7gMWVgJg.png)

What it means is that **every file in the loop has a runtime dependency on every other file in the loop, massively increasing the chances of transitive compile-time dependencies.**

In the example diagram below you can see there is a runtime dependency cycle between `A -> B -> C -> D -> E -> A -> ...etc`

![Dependency cycle diagram showing A, B, C, D, E in a loop, with F having a compile-time dependency on D](https://miro.medium.com/v2/resize:fit:1400/1*I13e29j43AaLmDYcYMHzvQ.png)

F has a compile time dependency on D, but because of the dependency cycle it means F also has a transitive compile-time dependency on A, B, C, and E! Now whenever any of those files change, F would also need to be recompiled.

In our example it actually doesn't have an impact because `Dinner` already had a transitive compile-time dependency on the other files. But imagine if the loop were 100 files long. Now any file that has a compile-time dependency on any of those files will also have a transitive compile-time dependency on the other 99 files. Overall it increases the number of files needing to be recompiled with each change, which is bad news for your incremental compile times.

## How do I know what type my dependencies are?

There are actually 3 types of dependencies:

- **Compile-time**, which happen in 2 main cases:
  1. When writing any code in the module body — i.e. outside of a function, like our example with module attributes
  2. When using Macros
- **Run-time**, which happen for any usual function calls
- **Export dependencies** — these are compile-time dependencies, but re-compilation is only needed for them when the module API changes (i.e. function args/arities change or a struct definition changes). They occur when you reference a struct from another module, or `import` the module

## What next?

In the next 2 articles we'll go through examples to help test your understanding, before finally sharing strategies to help improve compile times.
