# Mahjong Parlor

Ad-free mahjong and classic games for Grandma. Runs offline as an installable web app (PWA).

## What's in it
- 7 games against the same challengers: Mahjong, Solitaire (every deal can be won), Gin Rummy, Dominoes, Checkers, Five Dice, Word Search. Each game has big tap targets, a ❓ Rules button, auto-save and resume, and an opponent whose strength adjusts to her.
- Guided practice game before her first real game (8 coached steps on a 10-tile board). She can replay it from the Guide.
- 📖 Guide on the home screen: a one-page illustrated how-to-play, with a Practice button
- Mahjong solitaire, 5 board layouts, every deal guaranteed solvable
- 12 challengers with portraits, a trophy for 3 wins against each, then the next one unlocks
- Race against the challenger with no clock. The challenger only moves when she does, and each Hint/Undo/Shuffle lets them catch up a little
- Difficulty adjusts in the background to keep her win rate around 65%, and eases off after 2 losses in a row
- Win streak plus best streak (a loss never erases "Best")
- Puzzle of the Day: same board for everyone on a given date
- Unlimited undo and hints, plus a free shuffle whenever she's stuck (she never hits a dead end)
- Auto-saves after every move and resumes exactly where she left off
- Android back button returns to Home instead of closing the app

## Family settings
Press and hold **⚙ Family** (bottom right of Home) for 2 seconds.
- Name for the greeting
- Notes that show up after her wins
- Sound, read-aloud, darken blocked tiles, bigger tiles
- This week's stats
- Backup/restore file (do this once she's built up progress)

## Security and privacy
- No ads, accounts, analytics or third-party code
- Makes no network requests once installed (verified in testing: zero external requests)
- A strict Content-Security-Policy blocks every script except `app.js` and blocks every outside connection
- All data stays in the tablet's local storage
- Family notes are shown as plain text and never interpreted as HTML
- Restored backup files are checked field by field, and anything unexpected is dropped
- Needs no permissions (camera, mic, location, notifications)

## Host it (one time, free)
It needs HTTPS to install. Pick one:

**Cloudflare Pages or Netlify (recommended, because they apply the `_headers` security file)**
1. Netlify: open app.netlify.com/drop and drag the `mahjong-parlor` folder onto it.
2. Cloudflare: Workers & Pages → Create → Pages → Upload assets → upload the folder.

**GitHub Pages**
1. Push the folder to a repo, then Settings → Pages → deploy from the branch.
2. GitHub ignores `_headers`, but the CSP in `index.html` still applies.

## Install on her tablet
1. Open the URL in **Chrome**.
2. ⋮ menu → **Install app** (or **Add to Home screen**).
3. Open it once while online so it caches. After that it works offline.
4. Move the icon to her home screen dock and remove the old mahjong apps.

## Harden the tablet (prevents another reset)
- Uninstall the ad-filled games
- Play Store → Play Protect → on
- Settings → Apps → Special access → Install unknown apps → off for everything
- Chrome → Settings → Notifications → off (stops spam pop-ups from sites)
- Optional: Google Family Link or Play Store purchase/app approval, so new installs need you

## Updating
Edit the files, bump `CACHE` in `sw.js` (currently `v2`), and redeploy. She gets the update on her next launch.

## Customizing
- Challengers: the `CHALLENGERS` array in `app.js` (name, town, lines, layout, portrait colors)
- Wins needed per trophy: `WINS_FOR_TROPHY`
- Difficulty: `computeRate()`

## Not included yet
- Automatic weekly summary sent to you. That needs a small server, which adds an attack surface, so for now the stats are in Family settings.
- Voice-note messages (text notes only for now)
- Other games (rummy, dominoes and so on) on the same challenger system
