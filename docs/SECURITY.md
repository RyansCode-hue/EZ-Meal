# EZ Meal — Security notes

_Last reviewed: 2026-09-04, end of phase 7._

## Who can get in

- **Public sign-up is closed** on the hosted Supabase project (`[auth] enable_signup = false`, applied with `supabase config push`). Anyone who finds the site sees a login page and nothing else.
- **The invite code is the only door.** The `redeem-invite` Edge Function creates an account and joins it to the household in one step, but only with a valid household invite code. It runs under the service role, validates every field, refuses more than 10 failed attempts per hour from one address (`invite_attempts` table), and deletes the account again if joining fails so no orphan logins exist. Passwords pass through it to Supabase Auth over TLS and are never logged. Codes are 8 hex characters and can be rotated from settings.
- Accounts can also still be created from the dashboard when needed.
- Email/password only. Email confirmation is on. Site URL and redirect list point at the website and the app scheme.
- Each account belongs to exactly one household (unique index on `household_members.user_id`). Joining needs the household's invite code, which can be rotated from settings.

## What each person can see

- **Row Level Security on every table.** Policies compare `household_id` to `current_household_id()`, a `security definer` helper that reads the caller's membership. Members read and write only their household's rows; `household_members` rows can be edited only by their own user.
- **Privileges are explicit.** `authenticated` has table grants; `anon` has none on tables or functions (`20260904000000_grants.sql`); `service_role` is granted explicitly for the two functions that run under it (`20260909100000_service_role_grants.sql`). An unauthenticated request cannot read a table even if a policy were wrong.
- **Storage** bucket `recipe-photos` is private. Objects live under `<household_id>/…` and policies allow access only to that folder. The app reads through short-lived signed URLs.
- `app_settings` (the trigger's callback URL) has RLS with no policies: only the database owner reads it.
- `notification_log` is readable by household members, never writable from the app.

## Server-side functions

- All Edge Functions verify the caller through the Auth server (`_shared/auth.ts`) and require household membership, then act as the caller so RLS still applies. Gateway JWT verification is off because it cannot verify every key type; the in-function check is the control.
- **Claude key** lives only in Supabase function secrets (`ANTHROPIC_API_KEY`). `CLAUDE_MODEL` picks the model. Nothing AI-related ships in the app bundle.
- Input limits: text ≤ 20k chars, ≤ 4 recipe photos, ≤ 3 pantry photos, ≤ 8 chat turns of ≤ 2k chars, image types restricted to JPEG/PNG/WebP.
- **URL import** refuses non-http(s) schemes, loopback, link-local and private ranges, and IPv6 literals; follows redirects with a 15 s timeout; caps HTML at 3 MB; only copies an image if it is image/jpeg|png|webp and ≤ 8 MB.
- **notify-partner** is called by a database trigger, not the app. It has no caller auth by design; it re-reads the entry under the service role, refuses unknown entries, only pushes to other members who opted in, throttles to one message per household per 2 minutes, and never includes anything but the actor's display name, the meal title, and the day.
- All function failures return a specific message to the user and log `{fn, requestId, householdId, error}`.

## Client

- Supabase publishable key is public by design; RLS is the boundary.
- Sessions persist in AsyncStorage (localStorage on the web). Sign-out clears the persisted query cache so the next account never sees stale data.
- Persisted query cache holds household data for up to 24 h on the device; that is the offline feature and is acceptable for a two-person household app.
- No secrets, keys, or environment-specific values in the repo: `.env` is gitignored; EAS holds the two public values for builds.

## Known gaps and follow-ups

- No rate limit on Claude-backed functions beyond input caps. Two known users; revisit if the household count ever grows.
- Push tokens are stored in plaintext on `household_members` (visible to the other member). Acceptable for a household; would need a private table for a larger user base.
- The `notify-partner` webhook is unauthenticated. Worst case: a spurious "your partner changed the plan" message about a real entry. A shared secret via Vault would close this if it ever matters.
- Password reset is not built; the dashboard can send a reset email. Signed-in members can change their password in settings.
