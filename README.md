# carterscoding.com

My personal homepage. It's plain HTML, CSS, and JavaScript, with no frameworks, no build step, and no dependencies.

```
index.html             page structure
404.html               shown for any URL that doesn't exist; sends the visitor to the homepage
styles.css             all styling; theme colors/spacing/glows are CSS variables at the top
script.js              title animations, card tilt, particle background, card rendering, 404 banner
projects.js            the list of project cards  ← edit this to add projects
images/                card images (PNG, 1200×900) and social-preview.png (the link-preview picture)
fonts/                 JetBrains Mono, served from this site (OFL.txt is its licence)
card-image-prompt.txt  the brief for making a new card image (paste it into an image or design tool)
favicon.ico, apple-touch-icon.png   site icons for older browsers and phone home screens
robots.txt, sitemap.xml             tell search engines what to index
CNAME                  the custom domain for GitHub Pages (don't delete)
LICENSE                MIT for the code; see the note at the bottom for what it doesn't cover
```

---

## Add a project

Open `projects.js` and add one object to the `PROJECTS` array:

```js
{
  title: "My Cool Game",
  image: "images/my-cool-game.png",
  url: "https://my-cool-game.carterscoding.com/",
  alt: "Screenshot of the game's title screen", // optional
},
```

Cards show up in the same order as the list. To remove a card, delete its object. To reorder, move the objects.

- `url` opens in the same tab. It can be a full link (`https://…`) or a path on this site (`/my-cool-game/`). Anything else (like `javascript:`) is ignored and the card links nowhere.
- If `alt` is left out, the image alt text defaults to `Preview of <title>`.

## Swap images

To make a new card image, give an image or design tool the brief in [`card-image-prompt.txt`](card-image-prompt.txt). Then:

1. Put the image in the `images/` folder, e.g. `images/my-cool-game.png`.
2. Set that path as the project's `image` in `projects.js`. Paths are case-sensitive on the live site, so `My-Game.png` and `my-game.png` are different files.
3. Delete any old image in `images/` that no project uses anymore.

Tips:
- Card images are **PNG, 1200×900** (4:3, the same shape as the cards). That's sharp on retina screens at every card size.
- File size: the current images are about 135 KB to 335 KB each, except `four-kingdoms.png` at about 1.1 MB. Aim for under ~300 KB; the first card loads first, so a big image there slows the page the most. [squoosh.app](https://squoosh.app) can shrink a PNG without changing how it looks much.
- A dark gradient sits behind the title: the bottom ~30% is heavily darkened, it fades out up to about 60% of the way up, and the top is only lightly tinted. Put the interesting part in the top half.
- The card keeps the 4:3 shape on almost every screen, but on very narrow cards (phones under ~350px wide, and some in-between window widths) the sides get trimmed slightly. The image also zooms in a little (8% on hover), so keep important details away from the edges.
- If an image path is wrong or the file is missing, the card falls back to a green pattern instead of breaking.

## Change the look

Everything themeable in CSS is in the `:root { … }` block at the top of `styles.css`: colors, glow strengths, spacing, corner radius, fonts, and animation speeds.

- For a different accent color, change **both** `--c-accent` and `--c-accent-rgb` (the particles use the RGB version; keep it as three numbers with commas). Then retint `--c-bg-glow-2`, `--c-bg-glow-3`, `--c-card-fallback` and the `--c-flap-*` tile colors to match.
- For a different background, change **both** `--c-bg` and `--c-bg-rgb`.
- A few colors live outside `styles.css` and need changing by hand: the favicon in `index.html` (`%2300ff9c` and `%23050806`), `favicon.ico` and `apple-touch-icon.png`, the `theme-color` meta tag in both HTML files, the inline styles in `404.html`, the `COLORS` list in the DVD effect in `script.js`, and `images/social-preview.png` (a screenshot of the page).

## Title animations

Clicking the title plays one of 15 animations at random, never the same one twice in a row: `decode`, `scatter`, `glitch`, `shockwave`, `typewriter`, `crt`, `rain`, `flap`, `progress`, `jello`, `dvd`, `capslock`, `battery`, `autocorrect`, and `buffering`.

- **Try one on its own:** add `?effects=` plus its name to the URL, e.g. `http://localhost:8000/?effects=crt`. Separate several with commas: `?effects=crt,rain`.
- **Add a new one:** write a function inside `initTitle()` in `script.js` and add it to the `effects` object. It joins the random rotation automatically.
- **Remove one:** delete its name from the `effects` object.

## Page not found (404)

GitHub Pages (and Netlify) serve `404.html` for any URL on the site that doesn't exist. That page does one thing: it remembers the bad URL and sends the visitor to the homepage, where a banner at the bottom of the screen says the URL didn't exist and they've been redirected.

- The two files work as a pair. `404.html` saves the bad URL in the browser's `sessionStorage` under `carterscoding:notfound`; section 6 of `script.js` reads it, shows the banner once, and deletes it. If you rename the key, change it in both places.
- The banner stays until it's dismissed with the × or the Escape key. Its look is the `.banner` rules in `styles.css`.
- With JavaScript turned off the redirect still happens, just without the banner.
- It only covers this site. Each project subdomain is its own site with its own 404 page.
- To try it locally, open `http://localhost:8000/nope` with a server that serves `404.html` for missing pages (`npx serve` does; `python3 -m http.server` doesn't). Opening `/404.html` directly just redirects home without a banner, since that file does exist. Or visit a made-up URL on the live site.

## Run locally

Double-clicking `index.html` works, except that browsers won't load the font from a local file, so text shows in your system's monospace font. For behavior that matches the live site exactly, serve the folder instead:

```bash
cd path/to/Homepage
python3 -m http.server 8000
# then open http://localhost:8000
```

(`npx serve` also works if you have Node installed.)

---

## Deploy

### Option A: GitHub Pages

1. The code lives at [github.com/cksarge/Homepage](https://github.com/cksarge/Homepage) on the `main` branch, with `index.html` at the repo root. **Every file you commit is published on the site**, so check what's about to go in first. Push changes with:
   ```bash
   git status                      # make sure only the files you meant to change are listed
   git add index.html styles.css   # (the files you changed)
   git commit -m "Describe your change"
   git push
   ```
   `.gitignore` already keeps out editor folders, logs, `.env` files and the like.
2. In the repo on GitHub, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click Save.
3. Under **Custom domain** on the same page, enter `carterscoding.com` and click Save. This commits a `CNAME` file to the repo on GitHub. Keep it, and run `git pull` once so your local copy has it before you push again.
4. At your domain registrar, set these DNS records:

   | Type  | Name / Host | Value |
   |-------|-------------|-------|
   | A     | `@`         | `185.199.108.153` |
   | A     | `@`         | `185.199.109.153` |
   | A     | `@`         | `185.199.110.153` |
   | A     | `@`         | `185.199.111.153` |
   | AAAA  | `@`         | `2606:50c0:8000::153` |
   | AAAA  | `@`         | `2606:50c0:8001::153` |
   | AAAA  | `@`         | `2606:50c0:8002::153` |
   | AAAA  | `@`         | `2606:50c0:8003::153` |
   | CNAME | `www`       | `cksarge.github.io` |

   Remove any other A/AAAA records on `@` (registrars often add a "parked" one).
5. DNS can take anywhere from minutes to a day to update. When the Pages settings show the DNS check passing, turn on **Enforce HTTPS**.

To update the site later, commit and push. Pages redeploys within a minute or two. When you change `styles.css`, `script.js` or `projects.js`, also bump the `?v=…` date on those files in `index.html`, so visitors' browsers fetch the new copies instead of using a cached one for up to 10 minutes.

### Option B: Netlify

1. Sign in at [netlify.com](https://www.netlify.com), then **Add new site**:
   - **Quickest:** choose **Deploy manually** and drag a folder onto the page. Drag a copy that holds only the site files, not the whole `Homepage` folder: a manual upload sends everything in it, including hidden files like `.DS_Store` and `.git`.
   - **Auto-deploy on push (recommended):** choose **Import an existing project**, connect the GitHub repo, leave **Build command** empty, and set **Publish directory** to `.` (or leave it blank).
2. Go to **Domain management → Add a domain**, enter `carterscoding.com`, and follow the prompts. Netlify will also set up `www.carterscoding.com`.
3. Point DNS at Netlify. Pick one:
   - **Netlify DNS (easiest):** at your registrar, replace the nameservers with the four Netlify shows you.
   - **Keep your registrar's DNS:** add an `A` record for `@` → `75.2.60.5` and a `CNAME` for `www` → `<your-site-name>.netlify.app`.
4. Netlify issues a free HTTPS certificate automatically once DNS resolves.

---

## Notes

- **Reduced motion:** if a visitor's OS has "reduce motion" turned on, the particles, background drift, title animations, background click bursts, card tilt, and zoom are all turned off.
- **Performance:** the first row of card images loads straight away and the rest lazy-load, the particles pause when the tab is hidden, and fewer particles are drawn on phones.
- **No outside requests:** everything, including the JetBrains Mono font, is served from this site, so visitors' browsers never contact another server. A Content-Security-Policy in each HTML file enforces that. If you add something from another site (a script, font or image), add its address to that policy or the browser will block it.
- **Contact address:** `contact@carterscoding.com` is in the page as plain text on purpose, so it works without JavaScript; spam filtering is left to the mail routing.
