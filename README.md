# EZ Meal

Shared meal planning for a two-person household. Expo (React Native) on the front, Supabase on the back, Claude behind Supabase Edge Functions for the smart parts.

Spec: [docs/SPEC.md](docs/SPEC.md). Build plan: [tasks/todo.md](tasks/todo.md).

## One-time setup

### 1. Supabase project

1. Create a project at https://supabase.com/dashboard (free tier).
2. Public sign-up is closed; new members create their account with the household's invite code (the `redeem-invite` function). Email confirmation is left **on** for the rare dashboard-created account (decision 2026-09-04). After signing up, the confirmation link verifies the address and then redirects to the project's Site URL, which is still the default `localhost:3000`, so the browser shows a dead page. The account is confirmed regardless; go back to the app and sign in. If this gets annoying, `supabase config push` applies `supabase/config.toml` (confirmations off, Site URL `ezmeal://`) to the hosted project.
3. Link this repo and push the schema:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

4. Copy `.env.example` to `.env` and fill in the project URL and anon key from **Project Settings > API**.

### 2. Expo / EAS

```bash
eas login
eas init
```

Then give EAS the same two values so cloud builds can reach Supabase:

```bash
eas env:set --scope project --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT-REF.supabase.co --visibility plaintext --type string
eas env:set --scope project --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext --type string
```

Already done for this project (EAS project `@1ryansapps1/ez-meal`, preview environment).

## Day to day

```bash
npm install          # after pulling
npm run typecheck    # tsc
npm start            # Metro dev server (use a dev build or Expo Go on the phone)
npm run build:android   # EAS cloud build, produces an installable APK (only when asked; builds are rationed)
npm run deploy:web      # export the site and publish it to https://ez-meal.expo.app
```

### Website

The same app runs in the browser and can be pinned to an iPhone home screen (Share > Add to Home Screen). `npm run deploy:web` exports with the values in `.env` baked in, then pushes to EAS Hosting.

### Edge Functions

Claude is called only from `supabase/functions/*`. The key lives in Supabase secrets, never in the app:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set CLAUDE_MODEL=claude-sonnet-5
supabase functions deploy parse-recipe-text --no-verify-jwt
supabase functions deploy normalize-ingredients --no-verify-jwt
supabase functions deploy parse-recipe-file --no-verify-jwt
supabase functions deploy import-recipe-url --no-verify-jwt
supabase functions deploy parse-pantry-image --no-verify-jwt
supabase functions deploy suggest-meals --no-verify-jwt
supabase functions deploy estimate-nutrition --no-verify-jwt
supabase functions deploy notify-partner --no-verify-jwt   # called by a database trigger, not the app
supabase functions deploy redeem-invite --no-verify-jwt    # public: creates an account from an invite code
```

Functions: `parse-recipe-text` (pasted text), `parse-recipe-file` (photos, PDF, Word, text, Markdown, saved web pages), `import-recipe-url` (a web page, JSON-LD first), all sharing `_shared/parse.ts`; `normalize-ingredients` (grocery name and store section for hand-typed ingredients); `parse-pantry-image` (receipts and shelf photos to pantry items); `suggest-meals` (Ask on the Ideas tab); `estimate-nutrition` (per-serving estimate stored on the recipe); `redeem-invite` (create an account and join with an invite code, throttled); `notify-partner` (partner-activity push, called by the `plan_entries` trigger through pg_net, sends via Expo's push service).

`--no-verify-jwt` is intentional: each function verifies the session itself through the Auth server (see `supabase/functions/_shared/auth.ts`), which works with every JWT signing-key type.

### Testing the database locally

Docker must be running.

```bash
supabase start       # local Postgres, Auth, Storage on 127.0.0.1:54321
npm run test:db      # creates throwaway users and checks RPCs, RLS isolation, storage policies
supabase stop
```

After editing a migration, `supabase db reset` re-applies all of them.

To click through the UI against the local stack in a browser: seed a user with the admin API (see `supabase/tests/smoke.mjs` for the pattern), then export with `.env` moved aside so the local URL is baked in:

```bash
mv .env .env.bak && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=<local anon key> npx expo export -p web --clear; mv .env.bak .env
npx expo serve --port 8787
```

`--clear` matters: Metro caches the inlined env values between exports.

The first `eas build` asks to generate an Android keystore. Say yes and let EAS store it.

## iPhone build (when the Apple Developer account exists)

EAS handles signing. From this folder, signed in with `eas login`:

```bash
eas build --platform ios --profile preview
```

The first run asks for your Apple ID to create the certificate and a provisioning profile. A `preview` iOS build installs only on registered devices: run `eas device:create` once per iPhone (it sends a link that registers the device), then rebuild. For TestFlight instead, use `--profile production` and then `eas submit --platform ios`.

## Layout

```
app/                Expo Router routes
  (auth)/           sign-in, sign-up
  (tabs)/           Plan, Recipes (a stack: list, detail, edit, paste import), Groceries, Pantry, Ideas
  +html.tsx         web root document (PWA meta)
  household-setup   create or join a household
  settings          invite code, members, sign out
src/
  auth/             session provider
  household/        household queries and mutations
  recipes/          recipe types, queries, photo upload, quantity formatting
  plan/             planner queries, day card, pickers
  groceries/        grocery queries, offline check-off, item text parsing
  pantry/           pantry queries, status control
  ideas/            pantry matching, suggestions, nutrition
  notifications/    local reminders, push token registration
  components/       shared UI
  lib/              supabase client, query client, error text
  theme/            tokens
supabase/
  migrations/       schema, RLS, RPCs
  functions/        Edge Functions: parse-recipe-text, parse-recipe-file, import-recipe-url, normalize-ingredients, parse-pantry-image, suggest-meals, estimate-nutrition, _shared helpers
  tests/            database smoke test
```
