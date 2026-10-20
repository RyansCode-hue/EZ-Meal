# EZ Plan Roadmap

Updated 2026-10-19. Published copy: https://claude.ai/artifact/AHrtqMdykYC5eAku7Cudj7 (from `docs/roadmap.html`). This file is the source of truth.

EZ Meal is the meal planner Ryan and his wife use today. The next stage turns it into **EZ Plan**: one shared
place to capture and plan meals and household tasks.

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

Draft. The capture model below is the open question that shapes everything else in this stage.

### Phase 12: Rename to EZ Plan (Next after Stage 1)

| Item | Size | Notes |
| --- | --- | --- |
| New name and icon in the app and website | S | Display name only; the Android package id stays `com.ezmeal.app` so the installed app updates instead of reinstalling. |
| New website address | S | Proposed ez-plan.expo.app. The old ez-meal link must keep working for the home-screen icon on her iPhone. |
| Repo and docs | S | Rename the GitHub repo and project folder; keep history. |

### Phase 13: Capture and tasks (Later, Decide)

| Item | Size | Notes |
| --- | --- | --- |
| Pick the capture model | S | See the open decision below. |
| Shared inbox | M | One place to drop anything: typed, a photo, later voice. Claude sorts each item into a task, a grocery item, a meal idea, or a recipe, and either of you can correct it. |
| Tasks | L | Owner (Ryan, wife, or both), due date, repeat, done. Shows on the week view beside meals. |
| Task reminders | M | Reuses the meal notifications: due today, and "your partner gave you a task". |
| Navigation | M | Five tabs fit a phone. Proposal: Week, Inbox, Tasks, Meals (recipes, groceries, pantry inside), Ideas. |

## Open decisions

1. **Capture model.** Which four-part system should EZ Plan follow? Candidates: CODE (Capture, Organize,
   Distill, Express), PARA (Projects, Areas, Resources, Archives), or GTD's five steps (Capture, Clarify,
   Organize, Reflect, Engage).
2. **When to resume Android builds.** Phase 9 assumes soon.
3. **Apple Developer account timing.** Gates Phase 11.
4. **Chat history scope.** Kept per phone, or shared between both of you.
