# carterscoding.com

My personal homepage. It's plain HTML, CSS, and JavaScript, with no frameworks, no build step, and no dependencies.

```
index.html     page structure
styles.css     all styling; theme colors/spacing/glows are CSS variables at the top
script.js      title animations, card tilt, particle background, card rendering
projects.js    the list of project cards  ← edit this to add projects
images/        card images
```

---

## Add a project

Open `projects.js` and add one object to the `PROJECTS` array:

```js
{
  title: "My Cool Game",
  image: "images/my-cool-game.webp",
  url: "https://cksarge.github.io/my-cool-game/",
  alt: "Screenshot of the game's title screen", // optional
},
```

Cards show up in the same order as the list. To remove a card, delete its object. To reorder, move the objects.

- `url` opens in the same tab. It can be a full link (`https://…`) or a path on this site (`/my-cool-game/`).
- If `alt` is left out, the image alt text defaults to `Preview of <title>`.

## Swap images

1. Put the image in the `images/` folder, e.g. `images/my-cool-game.webp`.
2. Set that path as the project's `image` in `projects.js`.
3. Delete any old image in `images/` that no project uses anymore.

Tips:
- Make images **1200×900** (4:3, the same shape as the cards). That's sharp on retina screens at every card size. Other sizes still work because the card crops to fill, but the edges may get trimmed.
- The bottom third of the image sits under a dark gradient behind the title, so put the interesting part near the top or middle.
- Keep each image small (under ~200 KB). `.webp` or `.jpg` work well; convert screenshots at [squoosh.app](https://squoosh.app).
- If an image path is wrong or the file is missing, the card falls back to a green pattern instead of breaking.

## Change the look

Everything themeable is in the `:root { … }` block at the top of `styles.css`: colors, glow strengths, spacing, corner radius, fonts, and animation speeds. For a different accent color, change **both** `--c-accent` and `--c-accent-rgb` (the particles use the RGB version).

To add a new title animation, write a function inside `initTitle()` in `script.js` and add it to the `effects` object. It'll join the random rotation automatically.

## Run locally

Double-clicking `index.html` works. For behavior that matches the live site exactly, serve the folder instead:

```bash
cd path/to/Homepage
python3 -m http.server 8000
# then open http://localhost:8000
```

(`npx serve` also works if you have Node installed.)

---

## Deploy

### Option A: GitHub Pages

1. The code lives at [github.com/cksarge/Homepage](https://github.com/cksarge/Homepage) on the `main` branch, with `index.html` at the repo root. Push changes with:
   ```bash
   git add .
   git commit -m "Describe your change"
   git push
   ```
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

To update the site later, commit and push. Pages redeploys within a minute or two.

### Option B: Netlify

1. Sign in at [netlify.com](https://www.netlify.com), then **Add new site**:
   - **Quickest:** choose **Deploy manually** and drag the whole `Homepage` folder onto the page.
   - **Auto-deploy on push (recommended):** choose **Import an existing project**, connect the GitHub repo, leave **Build command** empty, and set **Publish directory** to `.` (or leave it blank).
2. Go to **Domain management → Add a domain**, enter `carterscoding.com`, and follow the prompts. Netlify will also set up `www.carterscoding.com`.
3. Point DNS at Netlify. Pick one:
   - **Netlify DNS (easiest):** at your registrar, replace the nameservers with the four Netlify shows you.
   - **Keep your registrar's DNS:** add an `A` record for `@` → `75.2.60.5` and a `CNAME` for `www` → `<your-site-name>.netlify.app`.
4. Netlify issues a free HTTPS certificate automatically once DNS resolves.

---

## Notes

- **Reduced motion:** if a visitor's OS has "reduce motion" turned on, the particles, background drift, title animations, card tilt, and zoom are all turned off.
- **Performance:** card images lazy-load, the particles pause when the tab is hidden, and fewer particles are drawn on phones. The only external request is the JetBrains Mono font, which falls back to the system monospace font if it can't load.
