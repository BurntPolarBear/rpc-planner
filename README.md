# RPC Planner

A curriculum planner and gradebook for homeschool families and RPC. It gives each
family a shared planner across devices, an honest AI-assisted read on how a
student's work compares to grade-level expectations, and a print-ready year-end
portfolio for evaluations.

Live app: https://rpc-planner.vercel.app

## What it does

- **Plan** weekly lessons per grade group, with comprehension questions (AI can draft them).
- **Student "Today" view** — kids see just their day's work; late work carries over automatically.
- **Review** — a parent approves submitted work before it counts.
- **Writing** — a 6-traits analysis with grade-level-aware feedback, discussion questions,
  and an optional voice-consistency signal (compares a new piece to the student's own past writing).
- **Grades** — grade typed work *or* photos of handwritten work; every AI grade is a
  *proposal* a parent reviews and can adjust before it's saved.
- **Report Card / Progress / Records** — weighted grades, national benchmark placement,
  course pace, and attendance.
- **Export** — a weekly plan and a print-first year-end portfolio built for evaluators.

## How it's built

- **Frontend:** React + Vite (plain JavaScript, no framework beyond React).
- **Data + sync:** Supabase (Postgres) — the app reads/writes one shared record and uses
  Supabase Realtime so changes on one device appear on another within seconds.
- **AI features:** Anthropic API, called from serverless functions in `/api` so the API key
  never reaches the browser.
- **Hosting:** Vercel (the `/api` folder becomes serverless functions automatically).

## Environment variables

Set these in **Vercel -> Project -> Settings -> Environment Variables** (and in a local
`.env` file if you run it on your own machine - see below). Never commit real values;
`.env` is gitignored.

| Variable | Where it's used | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | server (`/api`) | Anthropic API key for the AI features |

> Note: `VITE_`-prefixed values are visible in the browser by design - that's expected for
> a Supabase anon key. The Anthropic key is **not** prefixed and stays server-side.

## Supabase setup

The app stores its data in a single table:

```sql
create table app_data (
  id int primary key,
  content jsonb
);

-- The app reads and writes the row with id = 1.
insert into app_data (id, content) values (1, '{}'::jsonb);
```

Then enable **Realtime** for the `app_data` table (Supabase dashboard ->
Database -> Replication) so live cross-device sync works.

> Heads-up: today all data lives in this one row and is reachable with the anon key.
> That's fine for a single trusted family; adding accounts / per-family isolation
> (Supabase Auth + Row Level Security) is the planned next step before wider use.

## Running it locally

You need [Node.js](https://nodejs.org) (version 20 or newer).

```bash
npm install         # install dependencies (first time only)
npm run dev         # start the local dev server
npm run build       # produce a production build in /dist
npm run test:grades # run the grade-math tests
```

Create a `.env` file in the project root with the three variables above to run the
full app locally. (The AI `/api` functions run on Vercel; `npm run dev` serves the
frontend.)

## Deploying

The app is connected to Vercel and deploys automatically when changes land on the
`main` branch on GitHub. The GitHub Action in `.github/workflows/ci.yml` runs the
tests and a build on each push, so a broken change is caught before it ships.
