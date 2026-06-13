# Spec: Language Exchange — Intentional Discovery & Low-Pressure Connection

**Status:** Draft v1.0 — 2026-06-14  
**Author:** ExpatEvents Agent  
**Repositories:** `Event-Hub` (frontend + API routes) · `meh-auth` (user data + bot)

---

## Objective

Replace the current swipe/match mechanic with an intentional, community-first discovery experience. The goal is not to pair people romantically or gamify connections — it is to help expats find a language exchange partner they would genuinely enjoy spending time with, and then make the first step as concrete and low-stakes as possible (an upcoming event or a structured spark).

**Target user:** An expat in Moscow who is learning a new language and wants real practice partners, not app fatigue.

**Success looks like:**
- A user browses the Language Exchange directory, sees someone with relevant language overlap and shared interests, taps their card, and within 2 taps has either suggested a specific upcoming event or sent a Spark with the partner's real availability visible.
- Profiles feel like personal pages, not form submissions.
- No score, no match percentage, no swipe gesture anywhere in the flow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Wouter routing, TanStack Query v5 |
| UI components | shadcn/ui (Radix primitives), Tailwind CSS, Framer Motion |
| Backend (main) | Express + TypeScript, Drizzle ORM, Neon PostgreSQL |
| Backend (auth) | `meh-auth` — separate Express service, same Neon DB |
| Bot | Grammy (Telegram Bot API) in `meh-auth` |
| File uploads | Cloudinary / R2 (existing `uploadAvatar` pattern) |
| Auth | Session cookies via meh-auth, `useAuth()` hook in client |

---

## Commands

```bash
# Event-Hub
cd Event-Hub
npm run dev          # Vite dev server (port 5173) + Express server (port 3000)
npm run build        # Vite build + esbuild server bundle
npx tsc --noEmit     # Type-check (10 pre-existing errors in routes.ts — do not add new ones)

# meh-auth
cd meh-auth
npm run dev          # ts-node-esm server/index.ts
npx tsc --noEmit     # Type-check (currently clean)

# Both repos — push to GitHub after every batch
git push origin main
```

---

## Project Structure

```
Event-Hub/
  client/src/
    pages/
      LanguageExchange.tsx      ← partner browse grid (MODIFY)
      Profile.tsx               ← own profile editor (MODIFY)
      PublicProfile.tsx         ← read-only profile /profile/:userId (MODIFY)
    components/
      language/
        LanguageUserCard.tsx    ← partner card (MODIFY)
        SuggestEventDialog.tsx  ← NEW — event suggestion modal
        MomentsSection.tsx      ← NEW — 48h practice posts feed
      events/
        AttendeesAndReviews.tsx ← existing (no changes needed)
  server/
    routes.ts                  ← main API (MODIFY — event suggestion endpoint)
    notify-routes.ts           ← bot webhook routes (no changes needed for this spec)

meh-auth/
  shared/
    schema.ts                  ← Drizzle schema (ADD language_story column + language_posts table)
  drizzle/                     ← SQL migration files (ADD)
  server/
    routes/
      language-exchange.ts     ← LE API (MODIFY — add language_story to response, add moments routes)
    index.ts                   ← public profile proxy endpoint (MODIFY)
    storage.ts                 ← DB helpers (ADD moments helpers)
```

---

## Code Style

All new components follow the existing pattern in `LanguageUserCard.tsx`:

```tsx
// Inline comment block at top of file explaining the component's purpose
// and any non-obvious decisions.

// Types first, then helpers, then the component.
interface Props { person: LanguageUser; }

// Helpers are pure functions above the component, not methods.
function getLangFlag(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.flag ?? "🌐";
}

// Tailwind utility strings use array-join pattern for conditionals:
className={[
  "base classes",
  condition ? "active classes" : "inactive classes",
].join(" ")}

// API calls use TanStack Query; mutations use useMutation with onSuccess toast.
// No direct fetch() calls inside JSX.
```

Key conventions:
- `snake_case` for API response fields (to match Postgres column names)
- `camelCase` for TypeScript variables and React props
- Prefer `??` over `||` for null-coalescing
- All new DB columns use `notNull().default(...)` where possible
- New API routes follow the existing Express router pattern in `language-exchange.ts`

---

## Testing Strategy

- **Build verification** after every task: `npm run build` in Event-Hub must pass clean.
- **TypeScript check** after every backend change: `npx tsc --noEmit` in meh-auth must produce zero new errors.
- **Manual smoke test** in browser for every UI change before committing.
- No automated test suite currently exists — do not add one as part of this spec (tracked separately).
- Each task commit message must reference the spec task number (e.g. `feat(le): Task 3 — compatibility hints on partner cards`).

---

## Assumptions

1. No swipe, no match score, no percentage anywhere in this feature.
2. `1on1` meeting type remains premium-only (existing enforcement in `LanguageUserCard.tsx` stays).
3. The `language_story` field (140 char "How did you start learning X?") is a new column — requires a DB migration in meh-auth.
4. The Moments feed (`language_posts` table) is also a new table — requires a separate DB migration.
5. Public profile `/profile/:userId` route already exists — we are refining it, not rebuilding from scratch.
6. The availability grid data (in `availability_slots` table) is already stored — we just need to expose it in the public profile and the Spark dialog.
7. "Event Regular" badge: user has ≥1 confirmed attended RSVP in `Event-Hub.rsvps` (the `attended` column added in migration `0002`). meh-auth does not have direct access to this table — the badge flag needs to be set via a service call or exposed through a new cross-service field.
8. The `suggest-event` flow calls `Event-Hub`'s existing `/api/events` endpoint, filters by shared interests client-side, and sends the suggestion via the existing `/api/language-exchange/spark` route with an added `suggestedEventId` field.

---

## Boundaries

**Always do:**
- Run `npm run build` (Event-Hub) and `npx tsc --noEmit` (meh-auth) before committing.
- Keep `language_story` max 140 chars enforced both client and server.
- Never expose `email`, `password`, `telegramId`, `googleId`, `yandexId`, `appleId` in any public API response.
- Push both repos after completing each batch.

**Ask first:**
- Any change to the `users` table schema beyond adding `language_story`.
- Adding a new npm dependency.
- Changing the Spark Telegram message format (users may have come to rely on its structure).
- Adding a cross-service DB call between Event-Hub and meh-auth (currently they communicate via HTTP only).

**Never do:**
- Add a swipe gesture, match score, percentage, or "like" mechanic on partner cards.
- Store raw corrections or moments in Event-Hub's DB — all LE user data stays in meh-auth.
- Make the `leHidden` or `blocked` flags visible in any client-side response.
- Remove or rename existing API fields (breaking change for existing clients).

---

## Feature Scope & Task List

### Batch 1 — Quick wins, visible impact (no DB migrations)

- [ ] **Task 1 — Compatibility hints on LanguageUserCard**
  - Show contextual chips below the language badges: "🔄 Mutual language", "🎯 N shared interests", "📍 Same city", "⏰ Evenings free".
  - Computed purely client-side from `currentUser` profile vs. `person` props.
  - Acceptance: hints render correctly for users with/without overlap; no hint shown if overlap is zero.
  - Verify: `npm run build` clean; visual check in browser.
  - Files: `LanguageUserCard.tsx`, `LanguageExchange.tsx` (pass `currentUser` down).

- [ ] **Task 2 — "Suggest an Event" CTA on partner cards**
  - New `SuggestEventDialog.tsx` component: fetches 3 upcoming events matching shared interest categories, user picks one, sends a spark with `suggestedEventId`.
  - `POST /api/language-exchange/spark` gains optional `suggestedEventId` field — if present, the Telegram message includes the event name, date, and a link.
  - Acceptance: dialog opens, shows ≤3 relevant events (or a "no upcoming events" state), sends notification with event name in the message.
  - Verify: build clean; manual end-to-end in browser with a test user.
  - Files: `SuggestEventDialog.tsx` (new), `LanguageUserCard.tsx`, `meh-auth/server/routes/language-exchange.ts`.

- [ ] **Task 3 — Partner availability in Spark dialog**
  - The existing Spark time-slot picker currently shows your own slots with no context.
  - Add: fetch the recipient's `availability_slots` from `GET /api/language-exchange/users/:id/availability` (new endpoint) and show a read-only heat-map below the time slot picker with the label "Ana is usually free:".
  - Acceptance: availability grid renders for a user who has slots set; gracefully hidden if they have none.
  - Verify: build clean; visual check.
  - Files: `LanguageUserCard.tsx`, `meh-auth/server/routes/language-exchange.ts` (new GET endpoint).

- [ ] **Task 4 — Active-recently + mutual-language sorting in LanguageExchange**
  - Add `lastActiveAt` (timestamp) to the public fields returned by `GET /api/language-exchange/users`.
  - Sort: users with mutual language overlap first, then by `lastActiveAt` descending.
  - Profiles not active in 30+ days show a subtle "⏸ Last seen > 1 month ago" badge so browsers can calibrate.
  - Acceptance: sort order changes meaningfully; stale badge appears; no regression on filters.
  - Verify: build clean; visual check with 2+ test users.
  - Files: `meh-auth/server/routes/language-exchange.ts`, `LanguageExchange.tsx`.

---

### Batch 2 — Profile depth (1 DB migration in meh-auth)

- [ ] **Task 5 — Add `language_story` column (DB migration)**
  - New column `language_story TEXT` on `users` table in meh-auth.
  - Migration file: `meh-auth/drizzle/0003_add_language_story.sql`.
  - Schema update: `meh-auth/shared/schema.ts`.
  - Acceptance: migration runs on Neon without error; column writable via profile save.
  - Verify: `npx tsc --noEmit` clean; run migration script.
  - Files: `meh-auth/shared/schema.ts`, `meh-auth/drizzle/0003_add_language_story.sql`.

- [ ] **Task 6 — Language Story field on Profile & LanguageUserCard**
  - `Profile.tsx`: add a textarea for `languageStory` (140 char max, with a counter) with placeholder "How did you start learning [language]?". Show it directly below the bio section.
  - `LanguageUserCard.tsx`: if `language_story` is set, show it as an italic quote below the bio with a 🌱 icon.
  - `PublicProfile.tsx`: show `language_story` in the profile hero section.
  - `meh-auth/server/routes/language-exchange.ts`: include `languageStory` in the public user shape.
  - Acceptance: story saves, persists, renders on card and public profile.
  - Verify: build clean; save → reload cycle.
  - Files: `Profile.tsx`, `LanguageUserCard.tsx`, `PublicProfile.tsx`, `meh-auth/server/routes/language-exchange.ts`.

- [ ] **Task 7 — Inline completeness nudges on Profile**
  - Replace the global completeness bar prompt with inline contextual nudges on each empty section.
  - Bio empty → yellow banner directly above bio textarea: "✏️ Add a bio — partners are 3× more likely to respond."
  - Availability empty → nudge on availability section: "Set your availability to get more relevant sparks."
  - Language Story empty → subtle "Add your language story →" link below the field.
  - Acceptance: nudges show when sections are empty and disappear once filled (no page reload required).
  - Verify: build clean; test with incomplete profile.
  - Files: `Profile.tsx`.

- [ ] **Task 8 — Availability shown on PublicProfile**
  - `PublicProfile.tsx`: fetch `GET /api/language-exchange/users/:id/availability` (Task 3 endpoint) and render a compact read-only heat-map grid (days × hour blocks, greyed out vs. coloured).
  - Only show if the user has ≥1 slot set.
  - Acceptance: heat-map renders; graceful empty state.
  - Verify: build clean; visual check.
  - Files: `PublicProfile.tsx`.

---

### Batch 3 — Community features (1 new DB table in meh-auth)

- [ ] **Task 9 — `language_posts` table (DB migration)**
  - New table: `language_posts(id, user_id FK, text TEXT ≤140, language TEXT, likes integer[], expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)`.
  - Corrections stored as JSONB: `corrections JSONB DEFAULT '[]'` — array of `{ correctorId, original, suggestion, explanation? }`.
  - Migration file: `meh-auth/drizzle/0004_add_language_posts.sql`.
  - Acceptance: migration runs; Drizzle type-safe queries work.
  - Files: `meh-auth/shared/schema.ts`, `meh-auth/drizzle/0004_add_language_posts.sql`.

- [ ] **Task 10 — Moments API routes (meh-auth)**
  - `POST /api/language-exchange/moments` — create a post (auth required; max 140 chars; `expires_at = now + 48h`).
  - `GET /api/language-exchange/moments` — list non-expired posts, newest first, paginated; includes author's `displayName`, `avatarUrl`, `native`, `learning`.
  - `POST /api/language-exchange/moments/:id/like` — toggle like (auth required).
  - `POST /api/language-exchange/moments/:id/correct` — add a correction (auth required; body: `{ original, suggestion, explanation? }`).
  - Acceptance: full CRUD cycle works; expired posts excluded from listing; corrections append to JSONB array.
  - Verify: `npx tsc --noEmit` clean; manual API test with curl.
  - Files: `meh-auth/server/routes/language-exchange.ts`, `meh-auth/server/storage.ts`.

- [ ] **Task 11 — MomentsSection component + LanguageExchange integration**
  - New `MomentsSection.tsx`: shows top 5 recent moments above the partner grid on the LanguageExchange page.
  - Each moment card: avatar, name, post text (in target language), native→learning context, like button, correction button (opens inline text editor).
  - "Write a moment" button at the top (auth-gated; opens a small sheet with 140-char textarea + language selector).
  - Acceptance: moments load; like toggles; correction form submits; post form creates and appears immediately via QueryClient invalidation.
  - Verify: build clean; full interactive test.
  - Files: `MomentsSection.tsx` (new), `LanguageExchange.tsx`.

- [ ] **Task 12 — "Event Regular" badge**
  - Add a boolean `isEventRegular` field to the public LE user shape.
  - `meh-auth/server/routes/language-exchange.ts`: call `GET ${EXPAT_API_URL}/api/bot/events/attended-count?userId=X` (new Event-Hub endpoint, returns `{ count: number }`) to determine if attended ≥1.
  - Cache result per-user per-hour to avoid repeated cross-service calls.
  - `LanguageUserCard.tsx` and `PublicProfile.tsx`: show ✅ "Event Regular" badge if `isEventRegular = true`.
  - Acceptance: badge visible for users with ≥1 attended RSVP; not shown for others.
  - Verify: build clean; badge visible in browser for a known attended user.
  - Files: `LanguageUserCard.tsx`, `PublicProfile.tsx`, `meh-auth/server/routes/language-exchange.ts`, `Event-Hub/server/notify-routes.ts` (new endpoint).

---

## Open Questions

1. **`lastActiveAt` source** — should this be `users.createdAt` (existing) or do we add a `lastSeenAt` column that gets bumped on every authenticated request? Adding the column requires a migration. Simplest short-term: use `createdAt` as a rough proxy and improve later.

2. **Cross-service attended-count call (Task 12)** — meh-auth calling Event-Hub introduces a reverse dependency. Alternative: a nightly job syncs an `attendedEventCount` field onto the meh-auth users table. Simpler, but 24h stale. Confirm preferred approach before implementing Task 12.

3. **Moments moderation** — 48h auto-expiry reduces abuse surface, but there is no report/block on individual posts. Is this acceptable for launch, or do we need admin moderation tooling first?

4. **Language Story on partner cards** — showing it on `LanguageUserCard` makes the card taller. Is a collapsible "expand" pattern acceptable, or should it only show on the public profile?

---

## Success Criteria

- [ ] A user can browse Language Exchange, see compatibility hints on cards, and open a partner's public profile in ≤2 taps.
- [ ] A user can suggest a specific upcoming event to a partner without leaving the Language Exchange page.
- [ ] The Spark dialog shows the partner's real availability grid before the user picks time slots.
- [ ] A user can post a 140-char practice sentence in their target language and receive an inline correction from another user.
- [ ] The "Event Regular" badge correctly identifies users who have attended ≥1 ExpatEvents event.
- [ ] `npm run build` passes clean after every task.
- [ ] `npx tsc --noEmit` passes clean in meh-auth after every task.
- [ ] No swipe gesture, match score, or percentage appears anywhere in the feature.
