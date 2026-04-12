---
draft: false
title: "How to speed up your Elixir compile times (part 2) — test your understanding!"
snippet: "Test your understanding of Elixir's compilation model with these hands-on exercises covering compile-time dependencies, structs, imports, and macros."
image:
  {
    src: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?&fit=crop&w=430&h=240",
    alt: "Code on a screen",
  }
publishDate: "2022-08-31 00:00"
category: "Technology"
author: "Tim Gent"
tags: [elixir, compilation, performance]
---

This post gives a few examples to help you get your head around how the Elixir compiler deals with dependencies. Try your best to work out the answers without reading ahead — it'll do wonders for your understanding! You can find the [examples on Github](https://github.com/timgent/compile_examples). I also recommend reading [part 1 of the series](/blog/2022-08-17-how-to-speed-up-your-elixir-compile-times-part-1) which explains some key details of how Elixir compilation works.

## Challenges (solutions below)

**1. Starting simple**

If we edit `a.ex` below which files will be recompiled?

```elixir
# a.ex
defmodule A do
  def a, do: "a"
end

# b.ex
defmodule B do
  def b, do: A.a()
end
```

**2. Little harder…**

**Part a)** If we edit `a.ex` below which files will be recompiled?

**Part b)** If we edit `b.ex` below which files will be recompiled?

```elixir
# a.ex
defmodule A do
  def a, do: "a"
end

# b.ex
defmodule B do
  @a A.a()
  def b, do: @a
end
```

**3. Keep that brain working…**

If file `a.ex` is changed which files get recompiled?

```elixir
# a.ex
defmodule A do
  def a, do: "a"
end

# b.ex
defmodule B do
  def b, do: A.a()
end

# c.ex
defmodule C do
  @b B.b()
  def c, do: @b
end
```

**4. Still with me?**

If file `b.ex` is changed which files will be recompiled?

```elixir
# a.ex
defmodule A do
  def a, do: "a"
end

# b.ex
defmodule B do
  def b, do: A.a()
end

# c.ex
defmodule C do
  def c, do: B.b()
end

# d.ex
defmodule D do
  @a A.a()
  def d, do: @a
end
```

**5. Let's go round again…**

**Part a)**

If file `b.ex` is changed which files will be recompiled?

```elixir
# a.ex
defmodule A do
  def a, do: C.c()
end

# b.ex
defmodule B do
  def b, do: A.a()
end

# c.ex
defmodule C do
  def c, do: B.b()
end

# d.ex
defmodule D do
  @a A.a()
  def d, do: @a
end
```

**Part b)**

Same question but with the following tweak to the files:

```elixir
# a.ex
defmodule A do
  def a, do: C5.c()
  def a2, do: "a"
end

# b.ex
defmodule B do
  def b, do: A.a()
end

# c.ex
defmodule C do
  def c, do: B.b()
end

# d.ex
defmodule D do
  @a A.a2()
  def d, do: @a
end
```

**6. Let's think about structs**

```elixir
# a.ex
defmodule A do
  defstruct [:name, :age]

  def a, do: "a"
end

# b.ex
defmodule B6 do
  def b(%A{name: name}), do: name
end
```

**Part a)** If the field `height` were added to the struct defined in `a.ex` which file(s) would be recompiled?

**Part b)** If `A.a()` were updated to return `"b"` then which file(s) would be recompiled?

**7. More structs…**

If the field `height` were added to the struct defined in `a.ex` which file(s) would be recompiled?

```elixir
# a.ex
defmodule A do
  defstruct [:name, :age]

  def a, do: "a"
end

# b.ex
defmodule B6 do
  def b(%{name: name}), do: name
end
```

**8. What about using import?**

```elixir
# a.ex
defmodule A do
  def a, do: "a"
end

# b.ex
defmodule B6 do
  import A
  def b, do: a()
end
```

**Part a)** Which files would be recompiled if we change `A.a()` so it takes 1 argument?

**Part b)** Which files would be recompiled if we add a new function `foo` to the `A` module?

**Part c)** Which files would be recompiled if we make `a` return `"a2"` instead of just returning `"a"`?

**9. And Macros?**

```elixir
# a.ex
defmodule A9 do
  defmacro a(_clause), do: "X"

  def woo, do: "woo"
end

# b.ex
defmodule B9 do
  alias A9
  require A9
  def b, do: A9.a("some clause")
end
```

**Part a)** If we change the implementation of the `a` macro which files will be recompiled?

**Part b)** If we change the implementation of the `woo` function which files will be recompiled?

## Solutions

Have you answered all of the above challenges? Check below to see how you got on!

1. Only `a.ex` will be recompiled. `b.ex` only has a runtime dependency on `a.ex`, not a compile-time dependency.

2. **a)** `a.ex` and `b.ex` will both be recompiled because `b.ex` has a compile-time dependency on `a.ex`. Remember that any code outside of a method will be called at compile-time.

   **b)** Only `b.ex` will be recompiled — the dependency is only from b to a, not the other way around.

3. `a.ex` will be recompiled because it was modified. `c.ex` will be recompiled because it has a transitive compile-time dependency on C. Remember anything with a compile-time dependency on another file, will also have a transitive compile-time dependency on all the other file's runtime dependencies.

4. Only `b.ex` will be recompiled — no other files have a compile-time or transitive compile-time dependency on it!

5. **Part a)** This is a bit of a trick question. What will happen is the compiler will hang indefinitely in an infinite loop. At compile-time module `D` needs to call `A.a()`, which calls `C.c()`, which calls `B.b()` which calls `A.a()`, and so on in a never-ending loop.

   **Part b)** Fixes this issue, so in that case `b.ex` and `d.ex` will both be recompiled. `d.ex` will be recompiled because it has a compile-time dependency on `a.ex`. Because `a.ex` has a runtime dependency on `c.ex`, and `c.ex` depends on `b.ex`, `d.ex` therefore has transitive compile-time dependencies on `a.ex`, `b.ex`, and `c.ex`. You may have noticed a, b, and c form a dependency cycle, which is something to avoid if you can!

6. **Part a)** Both `a.ex` and `b.ex` would be recompiled — `a.ex` because it has been modified, and `b.ex` because it depends on the struct from `a.ex` and that struct has been modified.

   **Part b)** Only `a.ex` would be recompiled. Because `b.ex` has an export dependency (because it depends on the struct from A), it will need to be recompiled only if the struct itself changes. Other details of `A` can change and not impact `B` at all.

7. Only `a.ex` would be recompiled — as `B` no longer references the struct from `A` it doesn't have any dependencies on `A`.

8. **Part a)** `a.ex` and `b.ex` would both be recompiled. When you use `import`, if any of the function signatures (i.e. names of functions or the number of arguments) change then `b.ex` must be recompiled.

   **Part b)** `a.ex` and `b.ex` would both be recompiled. Again because we used `import`, any change in the function signatures (including adding a new function) triggers recompilation of `b.ex`.

   **Part c)** Only `a.ex` would be recompiled because only the implementation changed — the function signatures in `A` didn't change (all function names and numbers of arguments remained the same).

9. **Part a)** `a.ex` and `b.ex` will both be recompiled. `b.ex` has a compile-time dependency on `a.ex` because it calls the macro from `a.ex`, which is executed at compile-time.

   **Part b)** As with part a, both files will be recompiled. Remember compile-time dependencies are tracked at the file level, so even though we haven't changed the macro itself, `b.ex` still needs to be recompiled. Of course the compiled version of `b.ex` will be identical, but the compiler doesn't know that.

## What next?

In the next article in this series I'll share strategies to help improve compile times.
