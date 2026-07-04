# HYPERSYNC v2 — "Concert Dark"

Fresh rebuild. React + Vite frontend → Netlify Functions (all secrets server-side) → your existing base. GAS pipeline untouched.

## What's inside (Phase 0 + 1)

- `netlify/functions/` — the ONLY place any token lives
  - `data.mjs` — read-only public data (news, artists, posts, schedule, announcements, merch, campaigns), edge-cached 2 min
  - `auth.mjs` — Google sign-in verified server-side, fan record keyed by **email**
  - `credits.mjs` — balance / buy / verify. Prices live server-side. Browser can never write a balance.
  - `dm.mjs` — send message: price checked + deducted server-side
- `src/styles/global.css` — full design system (tokens, type, buttons, cards, chips, sync-pulse, reveal motion)
- `src/context/` — new AuthContext (Google Identity Services) + server-backed CreditContext
- `src/pages/Home.jsx` — new artist-first home: hero stage, sync strip, artists rail, upcoming events
- Placeholder routes for Artists / Feed / Schedule / Shop (Phases 2–4)

## Setup (once)

1. `npm install`
2. **Google sign-in:** Google Cloud Console → your existing OAuth client → add
   `https://hypersync.live`, `https://www.hypersync.live`, and `http://localhost:8888`
   to *Authorized JavaScript origins*. Copy the Client ID.
3. Copy `.env.example` → `.env`, set `VITE_GOOGLE_CLIENT_ID`.
4. **Netlify → Site → Environment variables**, add:
   - `AIRTABLE_TOKEN` (regenerate it first — the old one shipped in the old bundle)
   - `AIRTABLE_BASE_ID`
   - `GOOGLE_CLIENT_ID` (same value as the VITE one)
   - `SESSION_SECRET` (run `openssl rand -hex 32`, paste result)
   - `PAYMONGO_SECRET`
   - `VITE_GOOGLE_CLIENT_ID` (yes, also here, for the build)
5. One base tweak: in `CREDIT_PURCHASES`, make sure these fields exist:
   `Fan Email`, `Link ID`, `Credits`, `Amount`, `Status` (single line text is fine).
6. Replace `public/logo.png` with a transparent-background export of the logo,
   and add `public/favicon.png` (the bolt hex alone works great at 64px).

## Run locally

```bash
npm i -g netlify-cli   # once
netlify dev            # runs Vite + functions together at localhost:8888
```

`npm run dev` alone works for pure UI, but `/api/*` needs `netlify dev`.

## Deploy

Push to the new repo → link the repo in Netlify → point hypersync.live DNS at Netlify → delete the old Vercel project. Done.

## House rules encoded here

- No secret ever gets a `VITE_` prefix. `VITE_` = shipped to every visitor.
- Frontend talks only to `/api/*`. It doesn't know what's behind it.
- All balance changes happen in functions. The client only reads.
