---
draft: false
title: "My dev workflow with AI"
snippet: "Is what we need in this world yet another blog post about coding with LLMs?"
image: { src: "../../assets/ai-robot.jpg", alt: "" }
publishDate: "2026-04-12 00:00"
category: "Technology"
author: "Tim Gent"
tags: [AI, LLM, Claude Code]
---

Is what we need in this world yet another blog post about coding with LLMs? No? Tough luck. Silver lining - this one is written by a bona fide human being.

Let's keep this punchy - here is how I'm using AI in my personal coding workflows at home along with a few tips and tricks.

## Exploratory testing

In my experience, to make a really good, intuitive user experience takes a ton of tiny tweaks.
Every time I run through a user flow, there's always some little improvement to make. A wording tweak, a CSS change. A small bug fix.

I use a skill with Claude Code (any AI coding agent will do) that:

- Assumes a particular persona I give it
- Approaches my application as a new user would, with no knowledge of how it works or what it is for
- Writes me a report with screenshots of the flow, experiences at each step, and a list of any UX bugs or functional bugs they experience
- With my approval, turns each of these UX issues, functional bugs or general oddities into GitHub issues for me

It still has a tendency to miss the bigger picture and nicer ways to fix things, but it is fantastic at identifying small tweaks that make the experience for a new user better.
With tweaks to the prompt it can also help it highlight different sorts of bugs.

## Making decisions

Whether it's a technical or product decision, I will often ask an AI agent to present options with pros and cons for each and an overall recommendation.
I'll then enter plan mode to get a more complete plan for the chosen option.

I find this phrasing leads to better recommendations that are easier for me to engage with. With back and forth though I find the LLM can easily end
up favouring one option largely due to the chat history. Getting a summary of the decision and reasons and getting an agent with fresh context to
review can help give a sanity check for gnarlier decisions.

## Coding a feature

I have another skill that very simply tells Claude how to pick up a new issue - most notably saying to use TDD - red-green-refactor. I find this
makes for better tests, code that is more likely to work first time, and cleaner code thanks to an explicit refactor step. I also find exploratory
testing as part of coding a new feature is helpful, though don't always use this just as my Claude Pro plan is pretty stingy on tokens.

## Code reviews

For exploratory personal projects I skim-read the code - more interested in checking structure than correctness. Automated tests and an AI driven manual
test of the changes typically gives me enough confidence in correctness.

For real production work I still do a proper code review myself, and do often find subtle issues. Things like not wrapping the right things in a DB
transaction, or adding a migration that will cause a lock on the Database. Though as I find these subtle things adding skills and AI code review guidance to catch them helps avoid such issues

Cursor Bugbot has been great for code reviews in work contexts, but for personal use I find most of the code review skills too expensive. If it's
a high risk change I'll ask for a more targeted AI code review about the things that I'm worried about. Most AI Skills for code reviews I tried
spin up so many sub-agents it costs a lot in tokens. Worth it for a proper production app. Not worth it for my side projects.

## Tech debt and application architecture

The above approaches get features out quickly, but bugs can slip through. Usually this is something that can be more systematically fixed at
an architectural level in the code. I'm still using plain human prompts to do refactoring where I notice performance worsening or more bugs
slipping through. However I think a skill like exploratory testing above but for code quality could be valuable and it's something I want to play
with.

Most of the time I find improving the code architecture and patterns then means new tasks are also performed in line with that. However at times
it isn't enough - in those cases I'll look to add a new skill to guide it where common mistakes are happening.

## Safety, sandboxing, and working in parallel

Approving commands in an agentic coding workflow sucks, but having an AI go rogue on my personal machine would suck even more.
I've taken to using Claude Code Cloud environments for the majority of tasks. I take care to minimise tasks that would create
merge conflicts, but otherwise let it go to town. Right now I manually start new sessions with a simple "Pick up issue" prompt
and the skills then guide it to pick a new Github issue, mark it as taken, and create a plan which I review before it does the
code changes.

I tend to run 5-10 agents in parallel if I have enough tokens.

What I would really like is to have an API that I could programmatically spin up new Claude Cloud sessions with - then I could
have a process co-ordinating making sure I have several active agents at a time, spinning up new ones once old ones finish.
While I could build this myself I don't have the free time, and think it's highly likely this will get robust support from
companies over time.

## Where do I add value?

Right now it's the human-touch - spotting ongoing problems and guiding the agents to fix those, having a clear idea how
I'd like the application to work, etc. But I can
see more and more of this getting automated away. If I had unlimited AI tokens I would love to have a crack at an engine
to orchestrate the bits that I currently do. Taking on user feedback, responding, A-B testing, etc.

I do personally worry about the future for software engineers. In more complex systems that architectural guidance
is now a large part of the value of human devs - little side projects simply don't need that. Shepherding the AI
agents and making ongoing improvements, improving the "agent harness" etc are currently important (but also automatable IMO).
Product insight and guidance is also currently valuable. Can all of these things also be delegated to agents?
I'm not sure yet, but I wouldn't bet against it at this point. For now I'm just trying to keep up to date and make
the most of these powerful new tools we have.
