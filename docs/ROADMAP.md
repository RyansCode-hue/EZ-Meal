# EZ Plan Roadmap

Updated 2026-10-19. Published copy: https://claude.ai/artifact/AHrtqMdykYC5eAku7Cudj7 (from `docs/roadmap.html`). This file is the source of truth.

EZ Meal is the meal planner Ryan and his wife use today. The next stage turns it into **EZ Plan**: their shared
capture system for meals and household tasks, built on Capture, Organize, Review, Engage.

Status key: **Done**, **Next**, **Later**, **Decide** (needs a call from Ryan before work starts).
Size is rough relative effort: S (an evening), M (a few sessions), L (a week or more of sessions).

## Where things stand

| Area | State |
| --- | --- |
| Website (ez-meal.expo.app) | Live with everything built so far. Updates itself on open. |
| Android app | Last build 2026-09-04. Missing every change since. Builds paused until the website settles. |
| iPhone app | Not started. Needs the Apple Developer account. Wife uses the website meanwhile. |
| Backend (Supabase) | Live. Claude key fixed 2026-10-19 (org key plus workspace ID). |
| Code backup | 12 commits on this Mac only. GitHub push waits on `gh auth login`. |
| Tests | 68 app tests, database smoke test, integration tests on the local stack. |

## Built so far (Done)

- Phases 0 to 8 of the original plan: shared household with invite code, recipe book with paste, photo, file,
  and link import, weekly planner, grocery list by store section, pantry, ideas, notifications, website.
- Since: pantry amounts and container sizes, cooking subtracts from the pantry with unit conversion, named meals
  on the plan ("Tacos"), Ideas preview with "Save as a recipe", meal chat that builds recipes around an
  ingredient and remembers household notes.

## Stage 1: Finish EZ Meal

### Phase 9: Back it up and catch the phones up (Next)

| Item | Size | Notes |
| --- | --- | --- |
| Push the code to a private GitHub repo | S | Ryan runs `gh auth login`; Claude creates the repo and pushes. |
| Run the untested checks on the live site | S | Receipt photo, recipe-card photo, recipe link import, nutrition estimate, meal chat. |
| New Android build with everything since September | S | When Ryan says the website is stable. Then retest notifications on the phone. |
| Clean up the task checklist | S | Close items that are done; move the rest here. |

### Phase 10: Smarter pantry and chat (Next)

| Item | Size | Notes |
| --- | --- | --- |
| Grocery list subtracts pantry amounts | M | Today only Plenty and Low count. With amounts and unit conversion in place, "need 2 lb, have 1 lb" can list 1 lb. |
| Keep the meal chat after a reload | M | Notes already persist; the conversation and unsaved ideas do not. Decide per phone or shared. |
| "Find a recipe" from a named meal | S | Tap "Tacos" on the plan and ask the chat for a recipe that fits. |
| Receipt reader picks up package sizes | S | "16 oz box" on a receipt fills the container size. |

### Phase 11: iPhone app (Later, Decide)

| Item | Size | Notes |
| --- | --- | --- |
| Apple Developer Program | S | $99 a year. Ryan's call on timing. |
| iOS build and TestFlight install | M | Steps are in the README. Push notifications need the Apple key. |

## Stage 2: EZ Plan (meals and tasks)

EZ Plan follows Ryan's four-part capture system, close to GTD: **Capture, Organize, Review, Engage**. Meals are
one area inside it; the planner, grocery list, and pantry carry over unchanged.

| Step | What it means in EZ Plan |
| --- | --- |
| Capture | Get anything out of your head in a few seconds, from any screen, into one shared inbox. |
| Organize | Turn each inbox item into what it really is: a task, a grocery item, a meal on the plan, a recipe, or a note. |
| Review | Once a week, on the planning day (Saturday today), walk through the inbox, the coming week, and open tasks together. |
| Engage | Each day, open to what matters now: tonight's dinner, what is due, and who is doing it. |

### Phase 12: Rename to EZ Plan (Next after Stage 1)

| Item | Size | Notes |
| --- | --- | --- |
| New name and icon in the app and website | S | Display name only; the Android package id stays `com.ezmeal.app` so the installed app updates instead of reinstalling. |
| New website address | S | Proposed ez-plan.expo.app. The old ez-meal link must keep working for the home-screen icon on her iPhone. |
| Repo and docs | S | Rename the GitHub repo and project folder; keep history. |

### Phase 13: Capture (Later)

| Item | Size | Notes |
| --- | --- | --- |
| Shared inbox | M | One list both of you see, newest first, with who added each item. |
| Capture button on every screen | S | Type a line and press enter. Nothing else is required at capture time. |
| Photo capture | S | A receipt, a flyer, a recipe page, a note on the fridge. Stored with the item. |
| Voice capture | M | Later, phone only. Speech to text into the inbox. |
| Grocery shortcut | S | "Milk" typed into capture can go straight to the grocery list when Claude is sure. |

### Phase 14: Organize (Later)

| Item | Size | Notes |
| --- | --- | --- |
| Tasks | L | Title, owner (Ryan, his wife, or both), optional due date, repeat, notes, done. |
| Lists | M | Areas such as Home, Errands, Kids, Meals. Exact set is an open decision. |
| Process an inbox item | M | Turn it into a task, grocery item, plan entry, recipe, or note in one or two taps. |
| Claude suggests the sort | M | Proposes the type, owner, due date, and list; you accept or change it. Learns from household notes like the meal chat does. |
| Someday list | S | Ideas that are not for this week, kept out of the way until Review. |

### Phase 15: Review (Later)

| Item | Size | Notes |
| --- | --- | --- |
| Weekly review on the planning day | M | The Saturday reminder opens a guided review instead of only the planner. |
| Review steps | M | Empty the inbox, check last week (done, missed, carry over), plan meals, schedule tasks for the week, glance at Someday, then build the grocery list. |
| Review together | S | Both phones show the same review live, so you can do it side by side. |
| Daily glance | S | Optional evening check: anything still in the inbox, tomorrow's dinner. |

### Phase 16: Engage (Later)

| Item | Size | Notes |
| --- | --- | --- |
| Today screen | M | Opens first: tonight's dinner, tasks due today for you, overdue items, and what your partner has today. |
| Week view with meals and tasks | M | The current planner grows to show tasks beside meals on each day. |
| Task reminders | M | Built on the meal notifications: due today, and "your partner gave you a task". |
| Navigation | M | Five tabs: Today, Inbox, Week, Lists, Meals (recipes, groceries, pantry, and the meal chat inside). Review starts from the planning reminder or a button on Week. |

## Open decisions

1. **Capture model.** Decided 2026-10-19: Capture, Organize, Review, Engage.
2. **Private items.** Is everything shared between you two, or can each person keep private tasks?
3. **Lists.** Which areas to start with (proposed: Home, Errands, Meals, Someday) and whether lists can hold projects.
4. **When to resume Android builds.** Phase 9 assumes soon.
5. **Apple Developer account timing.** Gates Phase 11 and voice capture on iPhone.
6. **Chat history scope.** Kept per phone, or shared between both of you.
