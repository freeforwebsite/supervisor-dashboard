# Supervisor

A single dashboard to view and control services across multiple Render accounts.

## Setup

1. In Vercel → Project Settings → Environment Variables, add one pair per Render account you own:
   ```
   RENDER_API_KEY_1 = rnd_xxxxxxxxxxxx
   RENDER_ACCOUNT_1_NAME = Main
   RENDER_API_KEY_2 = rnd_yyyyyyyyyyyy
   RENDER_ACCOUNT_2_NAME = Bot farm 2
   ...
   RENDER_API_KEY_10 = ...
   RENDER_ACCOUNT_10_NAME = ...
   ```
   Only set as many as you actually have — unused numbers are skipped automatically.

2. Deploy. Vercel auto-detects the `/api` folder as serverless functions:
   - `GET  /api/services` — merged list of every service across all configured accounts
   - `POST /api/start`    — body `{ "serviceId": "...", "account": 1 }`
   - `POST /api/suspend`  — body `{ "serviceId": "...", "account": 1 }`

3. `index.html` currently shows mock data. Next step: wire its JS to fetch from `/api/services` and call `/api/start` / `/api/suspend` on button clicks instead of the local mock toggle.

## Security note
Render API keys are read only from server-side environment variables — never put them in `index.html` or any client-side JS.
