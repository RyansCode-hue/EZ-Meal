# EZ Meal — Build Plan

Spec: docs/SPEC.md

## Phase 0 — Foundation
- [x] Install EAS CLI and Supabase CLI
- [x] Create Expo app (TypeScript, Expo Router, tabs: Plan, Recipes, Groceries, Pantry, Ideas)
- [x] Create Supabase project and `supabase db push` (project ref lvirhpcptrayietwtoie, both migrations applied 2026-09-04)
- [x] Migrations checked into `supabase/migrations`
- [x] Schema + RLS for households, household_members, recipes, recipe_ingredients, recipe_steps, recipe_ratings, plan_entries, grocery_items, pantry_items
- [x] Email/password auth screens
- [x] Create household / join with invite code (RPCs + screens)
- [x] EAS Build config (`eas.json`, preview profile builds an APK)
- [x] EAS project created (`@1ryansapps1/ez-meal`), preview env vars set, Android keystore generated in the cloud
- [x] First APK installed (phase 0). Second APK built at the end of phase 7 (2026-09-04): https://expo.dev/artifacts/eas/wi6WrlnHQ_zsSfnRFKEDs2zoDOVHz1un9IYYti6jt0c.apk

## Phase 1 — Recipe book
- [x] Recipe list with search, tag and under-30-minute filters
- [x] Recipe detail with servings scaler, fraction display
- [x] Manual recipe form (ingredients, steps, photo upload to private bucket)
- [x] Edge Function `parse-recipe-text` (Claude Opus 5, structured output) + paste import screen with editable preview
- [x] Ratings and notes per person
- [x] `save_recipe` RPC: atomic insert/replace of recipe + children
- [x] Website build (Expo web, PWA manifest, icons) deployed to EAS Hosting
- [ ] Anthropic API key set as a Supabase secret (user: `supabase secrets set ANTHROPIC_API_KEY=...`)
- [ ] User test on the website and on Android (next APK after a few more phases)

## Phase 2 — Planner
- [x] Sunday–Saturday week view (week start from household settings), any number of entries per day, week navigation
- [x] Add recipe / eating out / skip; move up/down within a day; move to another day; per-entry servings
- [x] Realtime sync between phones (one channel per household, invalidates plan/recipes/groceries/pantry queries)
- [x] Mark cooked (RPC keeps recipes.last_cooked_at in step)
- [x] "Add to plan" from a recipe's detail screen, with the currently scaled servings

## Phase 3 — Groceries
- [x] Generate list from a date range (this week / next / both); merge by canonical name and normalized unit; scale to entry servings; skip cooked entries
- [x] Grouped by store section in store-walk order; realtime check-off with "checked by your partner"
- [x] Manual items with parsed amounts ("2 lb apples"); regenerate preserves checks and manual items; clear bought items
- [x] Offline: persisted query cache (24h), check-offs queue while offline and resume after restart, offline banner
- [x] Pantry hooks already wired: Plenty items skipped, Low items get "You have some" (pantry UI itself is phase 5)
- [x] `normalize-ingredients` Edge Function labels hand-typed ingredients with a grocery name and store section on save

## Phase 4 — Photo and URL import
- [x] Edge Function `parse-recipe-image` (Claude vision), up to 4 photos read as one recipe
- [x] Edge Function `import-recipe-url`: fetches the page, prefers schema.org Recipe JSON-LD, falls back to page text; copies the page's photo into the household bucket; refuses private/loopback hosts
- [x] Shared `_shared/parse.ts` structuring core used by text, photo, and URL importers
- [x] App: Photo and Website link options on the add sheet, `import-photo` (multi-select, camera on native) and `import-url` screens
- [ ] User test on the live site: a photo of a recipe card and a link to a recipe page

## Phase 5 — Pantry
- [x] Pantry list grouped by store section with Plenty / Low / Out per item, optional quantity, search, remove
- [x] Add by hand (amount parsed, section labeled through `normalize-ingredients`, falls back to Other with a notice)
- [x] Edge Function `parse-pantry-image` for receipts and shelf photos, with a tick-to-add review sheet
- [x] Mark cooked sheet on recipe entries: tracked ingredients show current status, untracked ones can start tracking; "Just mark cooked" skips it
- [x] `upsert_pantry_items` RPC: update-then-insert so omitted fields are kept
- [x] Grocery generation subtracts Plenty items, flags Low (from phase 3)
- [ ] User test on the live site: a receipt photo

## Phase 6 — Ideas
- [x] From the pantry: recipes ranked by ingredients on hand (Plenty or Low), with what is missing
- [x] Edge Function `suggest-meals`: loads the household's recipes and pantry under RLS, returns a short reply, matching book recipes, and up to two complete new recipes that save through the normal edit screen
- [x] Ask card with a short follow-up history and "Start over"; Open / Add to plan on suggestions
- [x] Surprise me: random recipe, avoiding anything cooked in the last 14 days
- [x] Edge Function `estimate-nutrition` stores per-serving estimates on the recipe; shown on the recipe page with assumptions and a re-estimate button
- [ ] User test on the live site: an Ask question and one nutrition estimate

## Phase 7 — Notifications
- [x] Planning reminder scheduled on the phone (day and time from household settings, per-member on/off)
- [x] Tonight's dinner reminder scheduled per day for the next week with the planned meals in the text; rescheduled whenever the plan or settings change
- [x] Partner activity: trigger on plan changes (pg_net) → `notify-partner` → Expo push; actor stamped on entries; 2-minute throttle per household; stale tokens cleared
- [x] Settings: reminders card (toggles, planning day, times), change password, web note that reminders arrive on the phone
- [ ] User test on the APK: allow notifications, then have the partner add a meal

## Phase 8 — Polish and iOS
- [x] Offline: pantry status changes queue offline and resume after restart (like grocery check-offs); every other write fails fast with "You're offline" instead of hanging
- [x] Root error boundary: a crashing screen shows the message and a Try again instead of going blank
- [x] Week start day editable in settings (with planning day, times, and reminder toggles)
- [x] docs/SECURITY.md: who can get in, what each person can see, function safeguards, known gaps
- [x] "Photo or file" import replaces photo-only: photos, PDFs (read natively by Claude), Word documents (unzipped server-side), text, Markdown, saved web pages; up to 5 mixed files per recipe (`parse-recipe-file`; `parse-recipe-image` retired)
- [x] Wide-screen rail drawn by the app itself (the navigator's own highlight showed behind the green block); Household moved to the bottom of the rail, header icon hidden there; phones unchanged
- [x] Invite code now creates the account: `redeem-invite` function (service role, validated, 10 failed tries per hour per address, rolls back on failure); sign-up screen asks for the code, name, email, password; public sign-up stays closed
- [x] Invite sign-up failed live with "not found": the hosted project grants `service_role` no table privileges by default, so the lookup errored and was reported as a miss. Fixed with `20260909100000_service_role_grants.sql`; the function now reports lookup errors as errors. This also unblocks `notify-partner`, which reads under the same role.
- [x] "Could not load your household. JSON object requested, multiple rows" once a second member joined: the membership lookup used maybeSingle() without filtering by user id, and RLS returns every member's row. Now filtered by the caller's id (also in the household settings update).
- [x] Recipe import: files upload to the private bucket one at a time and the reader fetches them (no request-size ceiling); limit raised to 10; clearer messages for size and timeout failures
- [x] Test suite: jest-expo with unit, component, and local-Supabase integration tests (`npm test`, `npm run test:integration`); the two-member household bug has a regression test
- [x] Android builds paused until website bugs are worked out (user request)
- [ ] Fixes from the user's phone testing
- [ ] iOS build via EAS (needs the Apple Developer account; steps in README)

## Review notes

### Phase 8 (2026-09-04, in progress)
- Verified: `tsc` clean; web deployed. Offline queueing for pantry uses the same persisted-mutation pattern as groceries (mutation defaults registered in `src/lib/query.ts`).
- Mutations default to `networkMode: 'always'` so offline attempts error immediately with a clear message; only grocery toggles and pantry upserts are offline-first.
- User reported the phase 7 push notifications working on two phones.

### Phase 7 (2026-09-04)
- Verified: `tsc` clean; DB smoke test (52 checks) incl. actor stamping, member prefs, settings table hidden; `notify-partner` validation paths locally.
- Not verified: an end-to-end push (needs the APK on two phones) and the trigger's HTTP call on hosted. The migration seeds `app_settings.functions_url` with the hosted URL; locally the trigger posts to hosted and is answered "entry not found".
- Reminders are phone-only by design; the website shows a note in settings.

### Phase 6 (2026-09-04)
- Verified: `tsc` clean; both functions' validation and lookup paths locally (bad body, bad or unknown recipe id, then the Claude call); the Ideas tab on a local build shows the pantry ranking with the right missing items and Surprise me works.
- Not verified live: Ask and nutrition (need the user's key).
- Hosted deep links and reloads return the page on every route (EAS Hosting rewrites for the single-page output); only the local `expo serve` lacks that fallback.

### Phase 5 (2026-09-04)
- Verified: `tsc` clean; DB smoke test (46 checks) passes; local browser run driven through the page (pane was hidden): pantry renders by section, a status tap saved, the Mark cooked sheet listed tracked and untracked ingredients, and Done marked the entry cooked, stamped the recipe, and wrote both pantry changes.
- Not verified live: the receipt reader (needs a real photo and the user's key).
- Lesson: RN-web renders icon glyphs as text inside pressables, so text lookups in browser scripts must use `includes`, not `startsWith`.

### Phase 4 (2026-09-04)
- Verified locally: validation and safety paths for both functions (empty/invalid images, bad URL, private host refused) and a real fetch of an allrecipes page reaching the Claude call. `tsc` clean; web export deployed.
- Not verified: the live Claude vision call and a live URL import end to end (user to try). Failure messages are specific on screen.
- Photos are resized to 1400px JPEG on the device before upload to keep requests small; up to 4 per recipe.

### Design session and port (2026-09-04)
- Design canvas (Claude Design preview): https://claude.ai/code/artifact/6c835ab9-228b-44b9-96d0-0a1983e52f5d. Direction B "Clean pantry" chosen. Screens page holds all built and planned screens plus the wide-window layout and a Styles sheet; the working files and generator live in `design/` (`python3 design/build.py` regenerates the artboards).
- Ported into the app: Bricolage Grotesque for headings and IBM Plex Sans for reading text (loaded via expo-font in the root layout; system fallback if loading fails), the active tab as a filled green block behind a white icon and label (bottom bar and left rail), and the planner day card with a weekday-and-numeral column.
- Colors were already the same tokens; radii and control heights unchanged (14 / 10 / 48).
- Planned screens on the canvas (Pantry, Mark cooked, Ideas, reminders, photo and link import options) are the reference for phases 4 to 7.

### Navigation and tags (2026-09-04, user feedback after phase 3)
- Recipe screens moved from a root-level stack into the Recipes tab (`app/(tabs)/recipes/`), so the tab bar stays visible on detail, edit, and import screens and there is always a way out. Saving a new recipe replaces the edit screen with the detail screen inside that stack, so back returns to the list.
- Tab bar is a left rail on browser windows 768px and wider, a bottom bar everywhere else. Fixed height/padding removed from the bottom bar so it pads itself above Android gesture bars and the iPhone home indicator.
- Tags are editable on the recipe page: tap × to remove, "+ tag" to add, with the book's existing tags offered as one-tap suggestions. Optimistic update, rolled back on error.
- Verified in the browser at 1100px and at the iPhone preset. Realtime confirmed in the browser: a tag appended by a script appeared without reload.

### Phase 3 (2026-09-04)
- Verified: `tsc` clean; DB smoke test (43 checks) passes incl. merge/scale/normalize, checked-item preservation, cooked-entry exclusion, pantry plenty/low, manual items, clear; browser test on the local stack: generate, check off, add "2 lb apples" by hand.
- Phase 1 paste import verified live by the user after two fixes: the SDK's zod schema helper produced a schema I did not want (enum demoted to description, `$ref` for strings), replaced by a hand-written schema; and Sonnet 5 rejects the `effort` parameter, now omitted.
- Realtime websocket errors appear locally right after `supabase db reset` (service restart); not a code issue. Hosted is unaffected.
- Sign-out now clears the local session even if the server rejects the logout (seen when a test account was deleted under a live session).
- Not verified live: `normalize-ingredients` (needs the user to save a hand-typed recipe). Failure path shows a "Save anyway?" confirm.

### Phase 2 (2026-09-04)
- Verified: `tsc` clean; DB smoke test (36 checks) passes; browser test against a local stack: sign in, add a recipe to a day, mark cooked, and an entry added from a separate script appeared without reload (realtime through RLS works).
- Planner RPCs (`add_plan_entry`, `reorder_plan_day`, `move_plan_entry`, `set_plan_entry_cooked`) assign positions server-side so two phones cannot collide.
- Gotcha: `expo export` inlines EXPO_PUBLIC_* from `.env` and Metro caches the result. To build against the local stack, move `.env` aside and pass `--clear`. `npm run deploy:web` now always passes `--clear`.
- Claude model is the `CLAUDE_MODEL` secret, set to claude-sonnet-5 (user's choice, 2026-09-04, about 1 cent per parsed recipe). Code default matches.

### Phase 1 (2026-09-04)
- Verified: `tsc` clean; local DB smoke test (26 checks incl. save_recipe, RLS on RPC, ratings embed) passes; Edge Function served locally answers CORS preflight, 401, 403, 400, and a clear 500 when the API key is missing; web and Android exports build.
- Not verified: an end-to-end paste import against Claude, because the API key is the user's to set. The function is deployed with `--no-verify-jwt` and verifies sessions itself via the Auth server.
- Manual entries get `canonical_name = lower(name)` and section `other`. Phase 3 grocery generation should normalize ingredients that lack a real section on demand.
- Decision: no Android build per phase (user request). The website at https://ez-meal.expo.app is the feedback loop; APKs on request.
- Website: `npx expo export -p web` then `eas deploy --prod`. Env vars come from `.env` at export time.
- Security (2026-09-04): public sign-ups closed on the hosted project via `supabase config push` (`[auth] enable_signup = false`). New members are created in the dashboard (Authentication > Users > Add user). Site URL now points at the website.
- Incident: `supabase config push` applies immediately when stdin is not a TTY; there is no preview mode. An earlier push also set `[auth.email] enable_signup = false`, which is the email-provider switch, and disabled all email logins for about 20 minutes until a corrected push restored them. config.toml now mirrors the hosted auth settings exactly, so future pushes show an empty diff unless a change is intended.
- Follow-up: add change-password to the settings screen so a dashboard-created account can pick its own password.

### Phase 0 (2026-09-04)
- Migration validated on local Supabase (Postgres 17) with a smoke script covering create/join/rotate RPCs, RLS isolation across three users, the updated_at trigger, and storage folder policies. All checks pass.
- `npx tsc --noEmit` clean. `npx expo export --platform android` bundles successfully.
- Fixed during review: hosted Supabase does not put `extensions` on the migration search path, so `gen_random_bytes` failed on `supabase db push` even though it passed locally. All pgcrypto calls are now schema-qualified via a `generate_invite_code()` helper. Lesson: local `db reset` passing is not proof a migration will push; qualify every extension call.
- Added `20260904000000_grants.sql`: explicit privileges for `authenticated`, everything revoked from `anon`. Hosted project denied anon on tables even before this, so the app cannot rely on project defaults either way.
- Hosted Supabase validates that sign-up email domains exist, so `npm run test:db` only runs against the local stack. First real verification on the hosted project is the user's own sign-in from the APK.
- Decision: email confirmation stays on for the hosted project. The confirm link lands on the default localhost Site URL after verifying; sign-in works afterwards. Revisit if it bothers anyone (`supabase config push`).
- `.env` populated with the hosted URL and publishable key. EAS init, env vars, and first preview build all run from this session after the user logged in.
