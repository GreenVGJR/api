> [!NOTE]
> Most of codes are vibecoded

---

## Setup

> [!NOTE]
> You need a VPS instance to run this.<br>
> Recommended at least 2GB of RAM, or 4GB with browser scraping installed

---

#### Requirements

- Git - clone the repo and `git pull` updates
- Bun - install deps, generate routes, run the server
- Node.js + npm - provides PM2 (`pm2-check` auto-installs it)
- Python3 - only for browser scraping (`python3` on Linux, `py` on Windows)

```bash
# 1. Clone (in empty folder)
npm run git-clone
# or
git clone https://github.com/GreenVGJR/api.git .

# 2. Install deps
bun install

# 3. Start the server (pm2)
bun run start
```

#### Update

```bash
bun run gen-update  # update to latest then restart
bun run soft-update # update to latest then hot-reload
```

#### Additional Setup

Optional, only for browser-rendered scraping endpoints.

```bash
# Linux
bun run browser-install

# Windows
bun run win-browser-install
```

Installs a local `.venv` with `scrapling[ai]` + Playwright chromium.

## Reference

- [AMC](https://github.com/GreenVGJR/amc)
- [Yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Morphe Patches](https://github.com/MorpheApp/morphe-patches)
- [Downr](https://downr.org)
- [Chocomilk API](https://choco.amira.us.kg)
- [Popcat API](https://popcat.xyz/api)

## Thanks to

- Tev, for assisting with api / giving ideas

License: [Unlicense](LICENSE)
