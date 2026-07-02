# LaunchDarkly — ExpatEvents Reference

## SDK Details

| SDK | Package | Key type | Init file |
|-----|---------|----------|-----------|
| Node.js server-side | `@launchdarkly/node-server-sdk` | SDK key | `server/launchdarkly.ts` |
| React client-side | `launchdarkly-react-client-sdk` | Client-side ID | `client/src/main.tsx` |

## Configuration

| Env var | Used by | Notes |
|---------|---------|-------|
| `LAUNCHDARKLY_SDK_KEY` | Server (Node) | Secret — never expose to browser |
| `VITE_LAUNCHDARKLY_CLIENT_SIDE_ID` | Client (React/Vite) | Safe to expose — injected at build time |

Keys live in: **app.launchdarkly.com → Project (default) → Environments → Production**

## Where to Find Things

- Dashboard: https://app.launchdarkly.com
- Feature flags: https://app.launchdarkly.com/default/production/features
- Environments (SDK keys): https://app.launchdarkly.com/settings/projects/default/environments
- Audit log: https://app.launchdarkly.com/settings/audit-log

## How Feature Flags Work

### Server-side (Express route)

```ts
import { getFlag } from "./launchdarkly";

// In any async route handler:
const showNewEventPage = await getFlag("new-event-page", req.user.id, false);

if (showNewEventPage) {
  // Return new experience
} else {
  // Return current experience
}
```

### Client-side (React component)

The React SDK camelCases flag keys — `new-event-page` becomes `newEventPage` in `useFlags()`.
The `useLDFlag` hook handles this transparently:

```tsx
import { useLDFlag } from "@/hooks/useLDFlag";

export function EventPage() {
  const showNewUI = useLDFlag("newEventPage", false);

  return showNewUI ? <NewEventPage /> : <CurrentEventPage />;
}
```

### Identifying users after login

Update the LaunchDarkly context when a user logs in so flags can be targeted by user ID, role, etc.:

```tsx
import { useLDClient } from "launchdarkly-react-client-sdk";

const ldClient = useLDClient();

// Call after successful login:
await ldClient?.identify({
  kind: "user",
  key: user.id,
  email: user.email,
  name: user.fullName,
});
```

## First Feature Flag

| Flag | Key | Status |
|------|-----|--------|
| New Event Page | `new-event-page` | ✅ Created — OFF in Production & Test |

Toggle it on at: https://app.launchdarkly.com/default/production/features/new-event-page

## Next Steps / Advanced Capabilities

- **Percentage rollouts** — gradually roll out to % of users: https://launchdarkly.com/docs/home/flags/rollouts
- **Targeting rules** — target by user attributes (role, country, email): https://launchdarkly.com/docs/home/flags/targeting
- **Experimentation / A/B testing** — measure impact of flags on metrics: https://launchdarkly.com/docs/home/experimentation
- **Guarded rollouts** — auto-rollback on metric regression: https://launchdarkly.com/docs/home/flags/guarded-rollouts
- **Observability** (formerly Highlight.io) — session replay + error tracking built into LD: https://launchdarkly.com/docs/home/observability

## Agent Integration (MCP)

The LaunchDarkly MCP server is configured in `.agents/mcps/config.json`.
It uses `$LAUNCHDARKLY_API_KEY` and provides tools for creating flags, targeting rules, experiments, dashboards, and more — all accessible directly from this agent.
