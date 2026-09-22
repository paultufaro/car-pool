# Carpool

Parent-to-parent carpool coordination for recurring school, sports and activity runs. Groups are
closed and invite-only; the app replaces the group text and the shared spreadsheet, not a rideshare
dispatcher. Pilot market is Summit, NJ with routes reaching Chatham, New Providence, Berkeley
Heights, Short Hills/Millburn and Madison.

## Setup

```bash
docker compose up -d          # Postgres 16 on localhost:5432
cp .env.example .env
npm install
npm run db:migrate            # or: npx prisma migrate dev
npm run db:seed               # Summit pilot demo data
npm run dev                   # http://localhost:3000
```

Demo logins (all password `carpool123`):

| Email | Role in demo |
| --- | --- |
| `dana@example.com` | Admin of "Lincoln-Hubbard 3rd Grade", drives the morning route |
| `marcus@example.com` | Second family on the morning route |
| `priya@example.com` | Solo route waiting for a second family |
| `jen@example.com` | Admin of "Summit Soccer Club U10 Travel", has an open swap request |
| `sam@example.com`, `nina@example.com` | Families on the Chatham practice route |

Other commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:reset`.

## Architecture

- **Next.js 15 App Router + TypeScript + Tailwind v4.** Pages are server components; every mutation
  is a server action in `src/app/actions/`.
- **PostgreSQL via Prisma** (`prisma/schema.prisma`). Proximity math runs in application code, so
  PostGIS is not required yet.
- **Auth** (`src/lib/auth.ts`): email + password with bcrypt, session in an HttpOnly JWT cookie
  (`jose`). Email and phone are each confirmed with a 6-digit code before a user can do anything.
- **Verification** (`src/lib/verification.ts`): codes expire in 15 minutes. With
  `SHOW_DEV_VERIFICATION_CODES=true` they are pre-filled in the UI so the app is usable without
  SMS/email providers.
- **Geocoding** (`src/lib/geocoding.ts`): Mapbox when `GEOCODER=mapbox` and `MAPBOX_TOKEN` are set,
  otherwise a built-in gazetteer of the pilot towns that spreads addresses deterministically within
  a town. Same interface either way.
- **Notifications** (`src/lib/notifications.ts`): SendGrid (email) and Twilio (SMS) when their keys
  are set; otherwise messages are logged to stdout. Every message is written to `notifications_log`
  regardless of channel.
- **Matching** (`src/lib/matching.ts`): a family matches a route when its home is within the route's
  radius of the origin *or* of the straight origin→destination line. Distances are haversine miles.
- **Reminders**: `POST /api/cron/reminders` notifies families driving today or tomorrow.
- **Rotation** (`src/lib/schedule.ts`): families take the wheel in blocks of `rotationWeeks`
  (weekly or biweekly), generated 8 weeks ahead. Regenerating after a membership change preserves
  past days and any day already touched by a swap.

## Implemented

Signup with email + phone verification · family profile with kids and geocoded home address ·
invite-code groups (school/sports/activity/neighborhood) · route proposals with day/time windows ·
proximity match suggestions on the dashboard and in groups · auto-generated rotating driving
calendar · swap request and one-tap claim with automatic reassignment · notification fan-out to
every family on a route · admin tools (rename group, change anchor, regenerate/revoke invite code,
remove member, dissolve group) · privacy rules (town-level location until two families share a
route) · placeholder Terms of Service.

## Stubbed or out of scope

- **Notification delivery** falls back to database logging until SendGrid/Twilio keys are set.
  Day-before and morning-of reminders are implemented as `POST /api/cron/reminders` (bearer
  `CRON_SECRET`), but nothing schedules it yet — point a Vercel cron or similar at it daily.
- **Geocoding** uses the local gazetteer unless a Mapbox token is configured; coordinates within a
  town are approximate.
- **Matching** is straight-line proximity, not driving distance. `scoreFamilyAgainstRoute` is the
  single extension point for a routing API.
- **Org partners** (schools, rec departments, clubs) are not modeled — groups cover the pilot.
- Deliberately absent per the brief: payments, paid/professional drivers, background checks,
  insurance verification, live GPS tracking, public/stranger discovery, native apps.
- **Terms of Service is placeholder text** and needs real legal review.
- No deployment has been provisioned from this repo; it runs locally with the steps above and
  deploys to Vercel + any managed Postgres without code changes.

## Assumptions made

1. **Join flow is invite-code only.** The brief allowed "invite code *or* admin approval", so there
   is no pending-approval queue; admins control membership by rotating the code and removing people.
2. **One parent per family record.** The schema supports several users per family, but the UI only
   creates the primary parent; inviting a co-parent to an existing family is not built.
3. **Address privacy line.** Other members see the town label; the street address and phone numbers
   appear only to families on the same route.
4. **Rotation granularity** is whole weeks per family (the common school-carpool pattern) rather
   than alternating individual days.
5. **Schedule horizon** is 8 weeks, regenerated whenever route membership changes.
6. **Passwords, not magic links** — email/phone verification is for contactability, not KYC.
