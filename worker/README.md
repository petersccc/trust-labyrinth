# Trust Labyrinth Worker: deployment checklist

This Worker is the only thing that ever holds the ClickUp API token. The
page never sees it, and nothing in this repo contains it. It is a new,
separate Worker: the two checkup Workers stay exactly as they are.

## Cloudflare dashboard (no install needed, same way as the checkups)

1. Go to **dash.cloudflare.com** → **Workers & Pages** → **Create** →
   **Create Worker**. Name it `trust-labyrinth-clickup-submit`.
2. Open the Worker's editor, replace the default code with the full
   contents of `trust-labyrinth-worker.js` from this folder, and deploy.
3. **Settings** → **Variables and Secrets** → **Add** → type **Secret**,
   name exactly `CLICKUP_API_TOKEN`, value: your ClickUp personal API
   token (the same one the checkup Workers use is fine). Save.
4. Copy the Worker's URL (it looks like
   `https://trust-labyrinth-clickup-submit.nachhilfe-kp.workers.dev`)
   and send it to Claude, who will put it into `clickup-submit.js`
   (`CLICKUP_WORKER_URL`).

## What it does in ClickUp

- No `ref`, or a `ref` that matches no task: a new task in the Lead
  Magnet list, named after the company. Description = language, room
  order, the cards picked in every room, where they got stuck,
  strengths, the free text and the date. E-Mail and Company are filled,
  Version = **Trust Labyrinth**, Source = **Cold**, Check-up completed is
  ticked.
- `ref` matches an existing task (its Ref Code field): E-Mail is set,
  Check-up completed is ticked, and the answers are added as a
  **comment**, so outreach notes already in that task's description are
  not overwritten. Version, Source and the task name stay as they were,
  the same as in the checkups.

## If the list ever changes

Field and dropdown option IDs are hardcoded (looked up from the live
list on 2026-10-08). Renaming an option is safe because it's matched by ID. Deleting
and re-creating a field or option changes its ID and needs an update here.
