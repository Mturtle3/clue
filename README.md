# Clue Nexus

Clue Nexus is a polished, live multiplayer mystery board game for 2–7 detectives. It runs as a static GitHub Pages site and uses Supabase only for the realtime room, anonymous guest sessions, hidden hands, and chat.

The repository includes a local demo mode, so the interface can be tested before Supabase is configured.

## What is included

- A connected tile-based mansion board where dice rolls control movement space-by-space, including marked secret passages.
- Classic suspect selection: each detective gets a fixed name, color, and pawn.
- Multiple guesses per turn, optional same-room repeat protection, and an optional rule to move the suggested suspect into the room.
- A private detective notebook that lists only the active deck for the current player count; your hand and cards shown privately are marked automatically.
- Suggestions, private card reveals with automatic note tracking, final accusations, event feed, private notes, and room chat.
- Room codes and anonymous guest sessions—friends do not create accounts.
- Classic cards plus balanced Nexus expansion cards.
- GitHub Pages deployment workflow.
- Supabase SQL migration and Edge Function source.

## Run the demo locally

No npm install is required.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` and choose **Create a room**. With Supabase keys blank, Clue Nexus opens a local three-player demo. You can switch between the demo detectives in the game header to try different turns.

## The balancing rule

The classic deck has 21 cards and 3 cards go into the solution envelope, leaving 18 cards to deal. Clue Nexus never removes cards to make the math work:

| Players | Cards dealt | Cards per player | New cards added |
| ---: | ---: | ---: | ---: |
| 2 | 18 | 9 | 0 |
| 3 | 18 | 6 | 0 |
| 4 | 20 | 5 | 2 |
| 5 | 20 | 4 | 2 |
| 6 | 18 | 3 | 0 |
| 7 | 21 | 3 | 3 |

The extra cards are new playable suspects, rooms, and weapons. They are not blank filler cards. When a player count already divides the classic deal evenly, no expansion is mathematically necessary.

## Connect the free Supabase backend

Supabase is the only service needed besides GitHub. Keep the Supabase organization on the **Free Plan** and do not add a payment method or paid add-on.

### 1. Create the project

Create a Supabase account and a new project on the Free Plan. In **Authentication → Providers**, enable **Anonymous Sign-Ins**.

### 2. Run the database setup

Open **SQL Editor → New query**, copy all of `supabase/migrations/0001_clue_nexus.sql`, paste it, and click **Run**. This creates the public room tables, private card table, security policies, and realtime publication.

### 3. Deploy the game action function

The Edge Function keeps the solution and hands on the server instead of exposing them to every browser. From the repository root, after installing the Supabase CLI if needed:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy game-action
```

The project reference is the first part of your Supabase URL, such as `abcdefghijklmnop` in `https://abcdefghijklmnop.supabase.co`.

### 4. Add the public browser keys

In Supabase, open **Project Settings → API** and copy the **Project URL** and the public **Publishable key** (or legacy `anon` key). Edit `config.js`:

```js
window.CLUE_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY",
};
```

Never put the `service_role` key in `config.js` or GitHub. The Edge Function receives its server-side secrets from Supabase automatically.

## Publish on GitHub Pages

1. Create a GitHub repository. A public repository works with GitHub Free.
2. Upload the repository files, including the `.github/workflows/deploy-pages.yml` workflow.
3. Commit your edited `config.js`.
4. Open the repository’s **Actions** tab and wait for **Deploy Clue Nexus** to finish.
5. In **Settings → Pages**, choose **GitHub Actions** if GitHub asks for a source.

The workflow publishes the repository directly; there is no build step and no npm dependency to install.

## Free-plan safety

This project does not include a billing integration. Keep the Supabase organization on Free, do not add a payment method, and do not upgrade or enable paid add-ons. If free quotas are reached, the app may stop creating new realtime activity until the quota resets, but the project is not configured to charge for overage.

## Troubleshooting

- **The app says demo mode:** `config.js` still has blank values, or the browser needs a refresh.
- **Guest session error:** enable Anonymous Sign-Ins in Supabase Authentication.
- **Room action error:** confirm the SQL migration ran and `game-action` was deployed after the latest code was uploaded.
- **Friends cannot connect:** confirm the GitHub Pages site is using the same Supabase URL/key and that the room was created after the function was deployed.
- **A project is paused:** resume it from the Supabase dashboard. Do not delete it unless you have exported anything you want to keep.
