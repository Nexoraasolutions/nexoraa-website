# Nexoraa Home Solutions — website

A static site. No build step, no framework, no dependencies to install. Every
file in this folder is served exactly as it is.

---

## Deploy: GitHub → Netlify

**1. Push this folder to a new GitHub repository**

```bash
cd nexoraa-website
git init
git add .
git commit -m "Nexoraa website"
git branch -M main
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

**2. Connect it on Netlify**

Netlify → *Add new site* → *Import an existing project* → GitHub → pick the repo.

Netlify reads `netlify.toml` and fills the settings in itself:

| Setting | Value |
| --- | --- |
| Build command | *(empty)* |
| Publish directory | `.` |

Click **Deploy**. It takes about twenty seconds. Every later `git push` to
`main` redeploys automatically.

**3. Point the domain at it**

Netlify → *Domain management* → *Add a domain you already own* →
`nexorahomesolution.com`, then follow the DNS instructions Netlify gives.
HTTPS is issued automatically once DNS resolves.

---

## What's here

```
index.html              the home page — the scroll-driven room experience
services.html           Services
about.html              About Us
contact.html            Contact Us  (enquiry form + map)
faq.html  projects.html
smart-home-automation.html  lighting-automation.html  home-cinema.html
security-surveillance.html  networking-wifi.html      access-control.html

css/style.css           the site's design system — colours, type, components
css/experience.css      the room: layer placement, chapters, panels, mobile
js/main.js              navigation, reveals, form handling, shared behaviour
js/experience.js        the room engine — camera, lighting, scroll spring
js/ambient-bg.js        the older animated background (used only by archive/)

assets/room/            the ten light layers cut out of the room photograph
assets/hero-room-web.jpg  the room photograph itself
assets/partners/        23 brand logos
assets/catalogues/      brand PDFs — see the README inside, they are not in
                        this package because of their size
assets/logo-*           Nexoraa marks

netlify.toml            deploy config: publish dir, security + cache headers
robots.txt  sitemap.xml
archive/index-original.html   the previous home page, kept for reference only
```

---

## The home page

The home page is one continuous room — a real photograph of a finished
installation, not a render — that relights itself as you scroll through six
chapters:

**Enter → Lighting → Daylight → Cinema → Security → The Home**

The lighting is real light from that photograph. Ten layers were cut out of the
single frame (the ceiling cove, the media wall, the lamp, the accent strip, the
television, the window daylight, the drapes) and are faded up and down
independently, so the room lights the way the installed room actually does.
Nothing is drawn or simulated.

Every other page carries the same room behind it, held still — no scroll effect
away from the home page, by design.

### Things worth knowing before editing

- **The room is a fixed background at `z-index: 0`.** Page content sits above
  it inside `<main>`. If you add a page, copy the structure of `about.html`:
  the `#nx-room` block, `class="xp xp-page"` on `<body>`, and the content
  wrapped in `<main class="xp-page__body">`.
- **Do not rename `#nx-room` to `#room`.** `js/main.js` clears an element with
  the id `room` on the old home page, which would wipe the entire background.
  There is a comment in `js/experience.js` explaining this.
- **The layer positions in `css/experience.css` are the exact regions the
  layers were cut from,** as percentages of the source photograph. Moving one
  puts that light somewhere it does not belong in the room.
- **Mobile is handled by a second set of camera framings** (`pzoom` / `pcx` /
  `pcy` in `js/experience.js`), used when the screen is taller than it is wide.
  Without them a landscape photograph on a phone shows about a quarter of the
  room.
- **Colours come from the CSS custom properties at the top of
  `css/style.css`** — `--cyan`, `--bg`, `--text-main` and so on. Change them
  there and the change carries across the whole site.

---

## Running it locally

Any static file server. With Node installed:

```bash
npx serve .
```

Then open the address it prints. Opening `index.html` straight off the disk
with `file://` also mostly works, but the browser blocks a few things, so a
server is the honest test.

---

## The enquiry form

The form on `contact.html` does what its button says: it opens WhatsApp to
**+91 81339 42204** with the enquiry already written out. There is no back end
and no third-party form service, so it works from the first deploy, and the
customer keeps their own copy of what they sent.

To collect submissions on Netlify as well, add `name="enquiry"`,
`method="POST"` and `data-netlify="true"` to the `<form>` tag — every field is
already named, so nothing else has to change.

---

## One thing left to do

**The catalogue PDFs.** See `assets/catalogues/README.txt`. Twenty download
buttons point at that folder and will 404 until the files are dropped in. The
filenames are listed there and have to match exactly.
