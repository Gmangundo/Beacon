# Beacon: setup from start to finish

## A. Supabase (once)
1. Supabase dashboard > **SQL Editor** > New query. Paste and Run each file, in this order, one at a time: `beacon_feud.sql`, then `beacon_feud_update.sql`, then `beacon_lockdown.sql`. Each should say "Success". (Never run `beacon_lockdown.sql` first.)
2. **Authentication > Sign In / Providers**: make sure **Allow anonymous sign-ins** is ON (players need it).
3. **Authentication > URL Configuration**: set **Site URL** to your GitHub Pages address (step B4), for example `https://YOURNAME.github.io/beacon/`, and add the same address under **Redirect URLs**.
4. `config.js` already holds your project URL and public key. Do not put any "service_role" or secret key in this repo.

## B. GitHub
1. Create a repository (for example `beacon`). Set it to Public (free Pages needs this on free accounts).
2. Unzip `beacon-github-files.zip`. On the repo page click **Add file > Upload files**, drag in ALL the files (not the zip itself), then **Commit changes**.
3. Go to **Settings > Pages**. Under Build and deployment choose **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. Wait about 1 minute. Your site is at `https://YOURNAME.github.io/beacon/`. Finish A3 with that address.

## C. Test before a real session (10 minutes)
1. Open `present.html`, log in as host, create a session. Open the site on your phone, join with the code. Confirm the emoji shows on the leaderboard.
2. Open `feud-host.html`, create a game (question plus 3 answers like `Genesis, 38`). Join `feud.html` from two phones, one with each team code. Confirm each lands on the right colour.
3. Click Open buzzers, buzz from both phones: only one team wins. Reveal an answer for a team and check the score.
4. Click Next question and check the scores are kept. Click Join call on the host and a phone.

## D. Later: move to Vercel
Vercel > Add New > Project > import the same GitHub repo > Deploy (no settings needed). Then add the new Vercel address to Supabase **URL Configuration** (A3).

## Known limits
- Calls use Jitsi's free public server. If it cuts calls short or limits you, tell me and we switch to a free-account version.
- Everyone with a team code can join that team. Share codes only with the right people.
