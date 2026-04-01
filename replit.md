# ExpatEvents — EventHub

A full-stack event management platform for expats. Built with React (Vite), Express, PostgreSQL (Drizzle ORM), and an external auth service.

## Architecture

- **Frontend**: React + Vite, Wouter routing, TanStack Query, Shadcn UI, Tailwind CSS
- **Backend**: Express server (`server/index.ts`), Drizzle ORM, PostgreSQL
- **Auth**: External service at `meh-auth.onrender.com` (or `VITE_AUTH_URL` / `AUTH_SERVICE_URL` env vars). Session cookies forwarded from client to auth service for validation.
- **Shared**: `shared/schema.ts` (DB models), `shared/routes.ts` (typed API routes), `shared/categories.ts` (event category constants)

## Running

Workflow: `NODE_ENV=development node_modules/.bin/tsx server/index.ts`  
Serves backend on port 5000; Vite proxies frontend assets on the same port.

## Pages & Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Home — browse events | Public |
| `/events/:id` | Event details & ticket purchase | Public |
| `/dashboard` | Organizer dashboard (my events + orders) | Protected |
| `/create-event` | Create a new event | Protected |
| `/orders/:id` | Order confirmation view | Protected |
| `/profile` | Profile, interests & availability schedule | Protected |

## Profile Page

Located at `client/src/pages/Profile.tsx`. Allows users to:
- View their identity (name, avatar, email, member badges)
- Connect Telegram for notifications (shows bot link and profile ID to paste)
- Select event interest categories (synced to meh-auth via `PATCH /api/user/interests`)
- Set weekly availability via drag grid (synced via `PUT /api/availability`)

The profile page talks **directly to the meh-auth service** (not through this app's backend) using `credentials: "include"` to pass the session cookie.

## Auth Integration

- `VITE_AUTH_URL` (frontend env) — URL of the meh-auth service, defaults to `https://meh-auth.onrender.com`
- `AUTH_SERVICE_URL` (backend env) — same service URL for server-side session validation
- `user.telegramId` is included in the User type for Telegram bot linkage status

## Key Files

- `client/src/hooks/use-auth.ts` — User type + login/logout/session
- `client/src/components/layout/Navbar.tsx` — Nav with Profile & Interests link
- `server/auth-client.ts` — `requireAuth` middleware (proxies session to meh-auth)
- `shared/categories.ts` — Event category list (used in profile, create event, and bot filtering)
- `server/routes.ts` — All API routes + DB seed on startup

## Telegram Bot & Cron

The Telegram bot and cron notifier live in the `meh-auth` repository. The bot links users by their profile ID (shown on the Profile page) and sends event notifications based on their interests and availability schedule.
