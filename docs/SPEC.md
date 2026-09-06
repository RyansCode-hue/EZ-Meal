# EZ Meal — Product & Technical Spec

_Last updated: 2026-09-03_

A shared meal-planning app for a two-person household. Android first, iOS later, one codebase.

## 1. Goals

1. Keep a shared recipe book that is painless to add to (type it, paste it, photograph it, or paste a URL).
2. Plan the week together on one calendar that both phones see instantly.
3. Turn the plan into a grocery list, grouped by store section, checkable while shopping.
4. Know roughly what is in the pantry so the list and suggestions account for it.
5. Answer "what should we make?" with pantry-aware, AI, or random suggestions.

## 2. Decisions (from requirements interview)

| Area | Decision |
|---|---|
| Platform | Expo (React Native, TypeScript). Android first via direct APK from EAS Build. iOS later. |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions. |
| AI | Claude API, called only from Supabase Edge Functions. API key never ships in the app. |
| Sharing | One household. Each person has an email/password login and joins the household with an invite code. |
| Planner | Week runs Sunday to Saturday. Any number of entries per day. Entry kinds: recipe, eating out, skip. |
| Planning reminder | Saturday. Time configurable. |
| Grocery list | Generated from a date range of the plan. Single list grouped by store section. Real-time check-off. Manual items allowed. Pantry items marked Plenty are left off. |
| Pantry | Per-item status Plenty / Low / Out, with optional quantity + unit for staples. Manual add, receipt or fridge photo, and a cook-confirmation sheet that updates status when a meal is marked cooked. |
| Recipes | Title, photo, prep and cook minutes, servings, cuisine, tags, ingredients, steps, per-person rating and notes, AI-estimated nutrition, last-cooked date. Servings scale ingredient amounts. |
| Import paths | Manual form, pasted text, photo of a recipe (card, book page, screenshot), website URL, AI-generated from a prompt. |
| Suggestions | What can we make from the pantry, AI chat ("something light with chicken"), random pick. |
| Units | Imperial display by default. |
| Offline | Recipes, plan, grocery list, and pantry readable offline. Grocery checks and pantry edits queue and sync when back online. |
| Notifications | Weekly planning reminder, tonight's dinner reminder, partner activity push. |
| Look | "EZ Meal". Clean and simple. Light theme, large tap targets for kitchen use. |

## 3. Architecture

```
┌──────────────┐   Supabase JS    ┌────────────────────────────┐
│  Expo app    │ ───────────────▶ │ Supabase                   │
│  (Android,   │  auth, queries,  │  Postgres + RLS            │
│   iOS later) │  realtime, files │  Auth (email/password)     │
│              │                  │  Storage (recipe photos)   │
│  local cache │ ◀─── realtime ── │  Realtime (plan, grocery)  │
│  + mutation  │                  │  Edge Functions ──────────┐│
│    queue     │ ── invoke ─────▶ │    parse-recipe-text      ││
└──────────────┘                  │    parse-recipe-image     ││
                                  │    import-recipe-url      ││
                                  │    generate-recipe        ││
                                  │    suggest-meals          ││
                                  │    estimate-nutrition     ││
                                  │    parse-pantry-image     ││
                                  │    notify-partner (webhook)││
                                  └───────────────────────────┼┘
                                                              ▼
                                                     Claude API (server-side key)
                                                     Expo Push API
```

### App layer
- **Expo SDK (latest), Expo Router** for file-based navigation. Tabs: Plan, Recipes, Groceries, Pantry, Ideas.
- **TanStack Query** with a persisted cache (MMKV) for offline reads. Mutations for grocery checks and pantry status use optimistic updates and an outbox that replays when online.
- **Supabase JS** client with the anon key. Row Level Security on every table scopes data to the caller's household.
- **expo-notifications** for local scheduled reminders. Partner activity arrives as push via the Expo Push service.
- **expo-image-picker / expo-camera** for recipe and pantry photos. Images are resized client-side before upload.

### Backend layer
- Postgres schema in section 4, managed with Supabase migrations checked into the repo.
- Edge Functions (Deno, TypeScript) hold the Anthropic API key as a secret. Every function verifies the caller's JWT and household membership before doing work.
- URL import tries structured data first (JSON-LD `Recipe` schema, which most recipe sites publish). Falls back to Claude on the page text only if that is missing.
- Ingredient normalization happens once at import time. Claude returns each ingredient with `canonical_name` and `store_section` so grocery merging is deterministic and needs no AI at list-generation time.
- A database webhook on `plan_entries` and `grocery_items` inserts calls `notify-partner`, which sends a push to the other household member.

## 4. Data model

All tables carry `household_id`, `created_at`, `updated_at`. RLS: a row is visible and editable only if `household_id` matches a household the caller belongs to.

```
households            id, name, invite_code, week_start_day (0=Sun), planning_day (6=Sat),
                      planning_time, dinner_reminder_time, units ('imperial')
household_members     household_id, user_id, display_name, expo_push_token

recipes               id, household_id, title, description, photo_path, prep_minutes,
                      cook_minutes, servings, cuisine, tags text[], source_type
                      ('manual'|'paste'|'url'|'photo'|'ai'), source_url, nutrition jsonb,
                      created_by, last_cooked_at
recipe_ingredients    id, recipe_id, position, quantity numeric, unit, name, preparation,
                      canonical_name, store_section
recipe_steps          id, recipe_id, position, text
recipe_ratings        recipe_id, user_id, rating (1-5), notes            (PK recipe_id+user_id)

plan_entries          id, household_id, date, position, kind ('recipe'|'eating_out'|'skip'),
                      recipe_id, label, servings, cooked_at, cooked_by

grocery_items         id, household_id, name, canonical_name, quantity, unit, store_section,
                      checked, checked_by, checked_at, is_manual, source_entry_ids uuid[]
pantry_items          id, household_id, canonical_name, display_name,
                      status ('plenty'|'low'|'out'), quantity, unit
```

Store sections (fixed enum): produce, meat_seafood, dairy_eggs, bakery, frozen, pantry, spices, canned_jarred, beverages, household, other.

## 5. Key flows

**Add recipe from paste.** User pastes text → app calls `parse-recipe-text` → Claude returns structured JSON (title, servings, times, ingredients with canonical names and sections, steps) → app shows an editable preview → user saves.

**Add recipe from photo.** Same, but the image is uploaded to Storage and `parse-recipe-image` sends it to Claude vision. Multi-page recipes accept several photos in one import.

**Plan the week.** Sunday–Saturday grid. Tap a day → add recipe (search or "Ideas"), eating out, or skip. Reorder within a day. Realtime channel keeps both phones in sync.

**Generate groceries.** Pick a date range (default: the current week). For each recipe entry, scale ingredients to the entry's servings, merge by canonical name and compatible unit, drop items whose pantry status is Plenty, mark Low items with "you have some". Regenerating merges into the existing list: checked state and manual items survive. Items sourced from a removed plan entry are removed if unchecked.

**Mark cooked.** From the plan, tap Cooked → a sheet lists the recipe's ingredients with current pantry status. Items the recipe fully consumes are pre-set to Out; others default to unchanged with one-tap Low / Out. Saves pantry updates and `last_cooked_at`.

**Ideas.** Three entry points: "From the pantry" ranks recipes by fraction of ingredients on hand (Plenty or Low). "Ask" opens a chat backed by `suggest-meals` that has the household's recipe titles and pantry as context and can propose either existing recipes or new ones (new ones can be saved with one tap). "Surprise me" picks a random recipe, weighted away from anything cooked in the last two weeks.

## 6. Build phases

| Phase | Deliverable | You can use it to... |
|---|---|---|
| 0 | Expo scaffold, Supabase project, auth, household create/join, EAS APK on both phones | Log in on both phones and see the same empty household |
| 1 | Recipe book: manual entry, paste import, list, search, tag/time filters, detail, photo, ratings/notes, servings scaling | Start moving your recipes in |
| 2 | Weekly planner with realtime sync, eating out/skip, mark cooked (without pantry yet) | Plan this week together |
| 3 | Grocery list generation, sections, realtime check-off, manual items, offline queue | Shop from the app |
| 4 | Photo import and URL import | Add recipes from cards, books, and websites |
| 5 | Pantry: manual, status, receipt/fridge photo, cook-confirmation sheet, grocery subtraction | Stop buying what you already have |
| 6 | Ideas tab: pantry-based, AI chat, random. Nutrition estimates on recipes | Decide faster |
| 7 | Notifications: planning reminder, tonight's dinner, partner activity | Get nudged |
| 8 | Offline hardening, polish, iOS build (needs Apple Developer account) | Install on an iPhone |

Each phase ends with an APK on both phones.

## 7. Accounts and costs

| Item | Cost | Needed by |
|---|---|---|
| Expo account (EAS Build free tier) | Free, limited builds/month | Phase 0 |
| Supabase project | Free tier | Phase 0 |
| Anthropic API key | Pay per use. Expect single-digit dollars/month for two people | Phase 1 |
| Google Play developer | $25 one-time, only if you want store distribution | Optional |
| Apple Developer Program | $99/year | Phase 8 |

## 8. Dev machine status (checked 2026-09-03)

Present: Node 22, npm 10, Homebrew, git, Xcode, Docker.
To install: EAS CLI (`npm i -g eas-cli`), Supabase CLI (`brew install supabase/tap/supabase`), watchman (`brew install watchman`, optional).
Not needed: Android Studio. EAS builds in the cloud and you test on real phones. Install it later only if you want an emulator.

## 9. Security notes

- The Anthropic key lives only in Supabase Edge Function secrets.
- RLS is the authorization boundary. Edge Functions use the caller's JWT, never the service role key, except `notify-partner` which runs from a database webhook.
- Invite codes are random, single-household, and can be rotated from settings.
- Photos go to a private Storage bucket; the app reads them through signed URLs.
- Every Edge Function logs failures with the function name, household id, and a request id. Parse failures return a structured error the app shows to the user rather than an empty recipe.
