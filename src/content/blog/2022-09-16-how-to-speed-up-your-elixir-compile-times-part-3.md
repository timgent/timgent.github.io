---
draft: false
title: "How to speed up your Elixir compile times (part 3) — strategies to improve your compile times"
snippet: "Practical strategies for reducing Elixir recompilation: cutting compile-time dependencies, breaking dependency cycles, profiling slow files, and Phoenix-specific tips."
image:
  {
    src: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?&fit=crop&w=430&h=240",
    alt: "Code on a screen",
  }
publishDate: "2022-09-16 00:00"
category: "Technology"
author: "Tim Gent"
tags: [elixir, compilation, performance]
---

In this post I'll share some strategies for improving the speed of recompilation. It's important you understand the fundamentals first, so please check out [part 1](/blog/2022-08-17-how-to-speed-up-your-elixir-compile-times-part-1) and ideally [part 2](/blog/2022-08-31-how-to-speed-up-your-elixir-compile-times-part-2) first!

## Reducing compile time dependencies

### Avoiding module attributes calling other modules

The big thing here is to **avoid using module attributes that call other modules.** It's a great way to reduce compile time dependencies. Instead just call those functions where you need them.

The only downside here is that you can't call functions in your module headers (for example if you want to pattern match on them). Instead consider using a `cond` or read on to see some other ways to handle this.

### Use alias instead of import

When you use `import` you create an export dependency between 2 files. By simply using `alias` instead no export dependencies are created.

### Sometimes you have to have compile-time dependencies though right?

It's absolutely true that sometimes you have to have compile time dependencies. Perhaps you want to use module attributes as you want to pattern match against them in your function headers like this:

```elixir
@active Status.active()
@disabled Status.disabled()
@old Status.old()

def handle_status(@active), do: ...
def handle_status(@disabled), do: ...
def handle_status(@old), do: ...
```

Or maybe you are implementing a behaviour, using the `use` keyword, or otherwise calling a macro.

In these cases the key things to make sure of are:

- **The file you have a compile-time dependency on has as few runtime dependencies as possible (ideally none)**
- **And any runtime dependencies it does have aren't part of a dependency cycle**

Let's take an example. Imagine you have these files:

```elixir
# a.ex
defmodule A do
  @active Status.active()
  ...
end
```

```elixir
# status.ex
defmodule Status do
  def active, do: "active"
  def do_other_stuff, do: B.other_stuff()
end
```

```elixir
# b.ex
defmodule B do
  # Let's imagine B calls other modules that form a circular dependency
  def other_stuff, do: ...
end
```

```elixir
# ...etc. Assume modules C and D here that form a dependency cycle
```

This results in the following dependencies:

![A compile time dependency on Status. Status has a runtime dependency on B, B has one on C, C has one on D, and D has one on B](https://miro.medium.com/v2/resize:fit:1400/1*MfLWlY73OI6O6FU5lDlHYQ.png)

This is now truly awful! B, C, and D are now transitive compile time dependencies of A. That means anytime B, C, or D change A will also need to be recompiled.

How could we fix this? In this case simply splitting the Status module in 2 — one containing our constants, and one containing functions that call out to other modules, like this:

```elixir
# a.ex
defmodule A do
  @active Status.Consts.active()
  ...
end
```

```elixir
# status/consts.ex
defmodule Status.Consts do
  def active, do: "active"
end
```

```elixir
# status.ex
defmodule Status do
  def do_other_stuff, do: B.other_stuff()
end
```

```elixir
# b.ex
...etc
```

![Dependency graph after splitting Status: A only compile-depends on Status.Consts, which has no runtime dependencies](https://miro.medium.com/v2/resize:fit:1400/1*Lp63GxV9LjeTVi6GDeBgww.png)

Now the only changes that will cause `a.ex` to be recompiled are changes to `a.ex` itself or changes to `status/consts.ex`. Woohoo!

A similar principle applies for defining behaviours or macros — try to remove as many runtime dependencies from those modules as possible!

The `mix xref graph --label compile-connected` command can help you find these troublesome cases where you have transitive compile-time dependencies.

## Reducing dependency cycles

As mentioned in part 1, dependency cycles are bad, especially big ones. They can lead to many more transitive compile-time dependencies, meaning more files need to be recompiled when you modify files. Here's how to stop this happening:

### Step 1 — identify your longest dependency cycles

`mix xref` will come in handy for this:

```
mix xref graph --format cycles
```

### Step 2 — identify where dependencies don't make sense

Looking at a long cycle of dependencies is a bit intimidating. Start by trying to identify a single call-chain that doesn't feel like it would be necessary. For example some common smells are things like:

- A sub-module depending on its parent
- A module reaching into a context that doesn't seem strictly related
- Generally any dependency where it doesn't make intuitive sense from the file names, when you just think "but why would this need to depend on that??"

**Let's take a real example from a cycle in our codebase**:

```
lib/platform/companies/events/company_created/publisher.ex
lib/platform/companies/events/json_serialiser.ex
lib/platform/companies/company.ex
lib/platform/roles/role.ex
lib/platform/roles/slug.ex
lib/platform/companies/companies.ex
lib/platform/companies/events/company_created/publisher.ex
```

One thing jumps out to me here — should slug (which generates a string to use in the URL) really need to know about companies? Surely it would get passed everything it needs to generate a slug?

### Step 3 — Remove those dependencies where you can

Generally this means refactoring the code, which could mean:

- Changing where you call functions from to remove a troublesome dependency
- Changing where the function causing the dependency cycle lives — perhaps moving it into a new module for example

In the example above, it turned out that a function in `slug.ex` was being passed a company_id, and then using the companies context to look up the details for the company. By instead passing the required company details to the function we could remove the function call in slug, and hence remove this dependency cycle.

### Step 4 — check your progress

In smaller projects running `mix xref graph --format cycles` is easy enough to see progress.

However if you have a lot of cycles it can be hard to feel like you're making progress — often fixes don't even reduce the number of loops, just reduce the number of steps per loop. You can use this nifty one liner to count the total steps across all your loops. You'll be amazed how fast you can drive this number down:

```
mix xref graph --format cycles | grep "Cycle of length" | sed 's/[^0-9]//g' | paste -sd+ - | bc
```

### Step 5 — stop dependency cycles re-occurring in your CI pipeline

`mix xref` has this handy command which you can use in your CI pipeline to make sure you're not introducing new dependency cycles.

```
mix xref graph --format cycles --fail-above X
```

## Identifying slow-compiling files

This command will help you identify slow-compiling files:

```
mix compile --force --profile time
```

Use this to help focus your efforts on refactoring, or at least reducing compile-time dependencies for the slowest files. Some other tools you might find helpful for debugging your dependencies are:

- `mix compile --verbose` will tell you which files are being recompiled, so you can change a single file and run a compilation in verbose mode to see what files that causes to be recompiled
- `mix xref trace FILE` for identifying what dependencies a given file has

## Tips for Phoenix compile times

When you call a macro (such as the `get` macro used in Phoenix routers) if you pass a full module name it creates a compile-time dependency on that module. For example this code has a compile-time dependency on `CandidatesWeb.LoginController`:

```elixir
scope "/candidates" do
  get "/", CandidatesWeb.LoginController, :delete
end
```

With Phoenix we can pass the outer module to scope. So with this code there is no compile-time dependency!

```elixir
scope "/candidates", CandidatesWeb do
  get "/", LoginController, :delete
end
```

NOTE: I believe this will be fixed in a future Phoenix release so the first example above doesn't create a compile-time dependency — watch this space!

## Inevitable dependency cycles with Phoenix

Phoenix has a design that naturally creates dependency cycles, because:

- A **router** contains the routes for your application, and depends on **controllers** to handle them
- **Controllers** have the logic for the route, and depend on contexts and **views** to display things to the user
- **Views** depend on **templates** to render things to the user
- **Templates** often contain links to other places in the site. These links tend to use Phoenix path helpers to ensure they are up to date. And of course, these path helpers depend on the **router**, and thus the cycle is formed
- Just to note, this dependency cycle still exists even if you use the new [Verified Routes functionality](https://github.com/phoenixframework/phoenix/blob/master/CHANGELOG.md#introduction-of-verified-routes) instead of the usual path helpers

So far we've not found a way to avoid these. Instead we follow the advice earlier in this guide and ensure that there are never compile-time dependencies on a file that is part of a runtime dependency cycle.

## Summary

I hope you've found this series helpful, and would love to hear any suggestions for more strategies to improve compilation times!
