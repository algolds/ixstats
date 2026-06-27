# Developer Onboarding

**Audience:** new developers joining IxStats, including those new to professional dev workflows.
**Goal:** get you from a fresh Windows laptop to running IxStats locally and making your first change.

This is the **front door**. It explains the mental model and the basics, then hands you off to the
deeper guides for each step. Read it top to bottom on day one.

> Two guides do the heavy lifting and are linked throughout:
> - **[Local Dev Setup](../operations/local-dev-setup.md)** — full WSL2 + Docker + SSH tunnel setup (follow this for the actual install).
> - **[Contributing Guide](contributing.md)** — branch/PR/test expectations once you're set up.

---

## 1. What you're working on

IxStats (product name **IxStates**) is a nation-simulation and worldbuilding web app. It's **not** one
program — the wider server (`ixwiki`) hosts several connected systems. You'll mostly touch IxStats.

| System | What it is | You touch it? |
|--------|------------|---------------|
| **IxStats** (`/ixwiki/public/projects/ixstats`) | The Next.js app — the thing we build. | Yes, daily |
| **MediaWiki** (`/ixwiki/mediawiki`) | The community wiki (ixwiki.com). | Rarely |
| **Discord bot** (`/ixwiki/shared/bots/discord`) | Keeps "IxTime" (game time) in sync. | Rarely |
| **IxWorld maps** | The interactive map (maps.ixwiki.com), built from IxStats. | Sometimes |

**The stack** (you don't need to know all of it yet — just recognize the words):
Next.js 16 + React 19 (frontend), tRPC (API), Prisma + PostgreSQL (database), Tailwind CSS v4
(styling), TypeScript everywhere. Read `README.md` and `arch.md` in the project root once for the
big picture.

> New to web development as a whole? Read **§12 How web dev works** first — it explains what
> JavaScript, bun, packages, frontend/backend, and the request lifecycle actually are, mapped onto
> IxStats. The names above will make sense afterward.

---

## 2. The environment you're mimicking

We all develop the same way so problems are reproducible. The setup is:

```
Windows laptop
 ├─ PuTTY ............. SSH terminal into the production server (for ops/looking around)
 ├─ WSL2 (Ubuntu) ..... a real Linux running inside Windows — THIS is where you code
 │   ├─ the git repo (lives in Linux home, e.g. ~/projects/ixstats)
 │   ├─ Docker ........ runs your local Postgres DB + Redis
 │   └─ bun / node .... runs the app
 └─ VS Code or Cursor . the editor (Windows app, edits files inside WSL)
```

**Why WSL2 and not plain Windows?** The production server is Linux. Developing on Linux (via WSL2)
means your machine behaves like production. The big rule: **the code lives inside the Linux
filesystem** (`~/projects/...`), never on `/mnt/c/...` — Windows-mounted folders are 10–20× slower and
break file-watching. The Local Dev Setup guide repeats this because people forget it.

---

## 3. Vocabulary you'll hear (the absolute basics)

If these are already familiar, skip to §4. For hands-on basics (using the terminal, the edit→run→see
loop, reading errors, debugging), see **§11 Dev fundamentals** at the end.

- **Terminal / shell** — the text window where you type commands. In WSL it's `bash`.
- **SSH** — secure way to log into a remote computer's terminal over the network. PuTTY is one SSH client.
- **SSH key** — a password-less login: a *private* key stays on your laptop, the matching *public* key
  is registered on the server/GitHub. Never share or commit the private key.
- **Git** — version control. Tracks every change, lets many people work without overwriting each other.
  - *repo* = the project folder under git's control. *commit* = a saved snapshot. *branch* = a parallel
    line of work. *push/pull* = upload/download commits to/from GitHub. *PR (pull request)* = "please
    review and merge my branch."
- **bun** — our package manager and script runner (like npm, but faster). **We use `bun` only.**
- **Docker** — runs the database and cache in isolated "containers" so you don't install them by hand.
- **tRPC / Prisma / Next.js** — app frameworks. You'll learn these by reading code, not upfront.

---

## 4. Accounts & access to request from the lead

Before you can do anything, ask for:

1. **SSH access to the `ixwiki` server** — your public SSH key added to the server. (You'll generate the
   key in §5.)
2. **GitHub access** — added as a collaborator on the repo; your public key or login on GitHub.
3. **The dev `.env.local`** — the file of secrets/config the app needs. It is **not** in git. The lead
   sends it to you securely. (`.env.example` in the repo shows the shape, but has no real values.)
4. **Clerk dev credentials** — for login/auth during development (part of `.env.local`).
5. **Discord** — for team comms and because the bot/alerts run there.

> Don't proceed past §6 until you have the SSH key registered and the `.env.local` in hand.

---

## 5. Install your tools (Windows)

Do these in order. The Local Dev Setup guide has the exact commands — this is the checklist.

1. **PuTTY** + **PuTTYgen** — download from putty.org. PuTTY = SSH terminal, PuTTYgen = key generator.
2. **WSL2 with Ubuntu** — in an *Administrator* PowerShell: `wsl --install -d Ubuntu-24.04`, reboot,
   then set a Linux username/password. Verify with `wsl -l -v` (Version must be `2`).
   → full steps incl. the memory cap (`.wslconfig`): [Local Dev Setup §Part 1](../operations/local-dev-setup.md).
3. **VS Code** (or **Cursor**) on Windows + the **WSL extension** — this lets the editor open folders
   *inside* WSL. You'll open the project with `code .` from the WSL terminal.
4. Inside WSL (Ubuntu terminal), install: **git**, **bun**, **Docker**. Commands are in the setup guide.

### Generating your SSH key

You need one keypair for both the server and GitHub.

- In WSL: `ssh-keygen -t ed25519 -C "you@email"` → press Enter through the prompts. This makes
  `~/.ssh/id_ed25519` (private — keep secret) and `~/.ssh/id_ed25519.pub` (public — share this).
- Send the **`.pub`** contents to the lead (for the server) and add it to **GitHub → Settings → SSH keys**.
- *PuTTY note:* PuTTY uses its own key format. Either generate a key in **PuTTYgen** and give the lead
  that public key, or import your WSL key. Simplest: keep WSL for git/coding, use PuTTY only for poking
  at the server.

---

## 6. Connecting to the server (PuTTY)

You'll rarely deploy, but you should be able to look around production.

1. Open PuTTY → enter the server hostname → load your private key under
   *Connection → SSH → Auth → Credentials* → Open.
2. You're now in the server's Linux terminal. Useful first commands:
   - `df -h /` — disk space. **If the app is throwing "database system is in recovery mode" errors, a
     full disk is the #1 cause** — check this first.
   - `cd /ixwiki/public/projects/ixstats` — the project on the server.
   - `pm2 list` — see running production processes.
3. **Read-only mindset.** Don't run build/db/delete commands on the server unless the lead is walking you
   through it. Production has live data for 80+ nations. The project `CLAUDE.md` lists the destructive
   commands that are blocked for a reason.

---

## 7. Get the app running locally

Now the payoff. **Do this inside WSL, in the Linux filesystem.**

```bash
# 1. Clone into your Linux home (NOT /mnt/c)
mkdir -p ~/projects && cd ~/projects
git clone <repo-ssh-url> ixstats
cd ixstats

# 2. Use the active branch
git checkout v2

# 3. Drop in the .env.local the lead gave you (into the project root)

# 4. Install dependencies (also generates the Prisma client)
bun install

# 5. Start everything — this boots Docker DB + Redis + SSH tunnels + the app
bun run dev:local
```

Open **http://localhost:3000** in your Windows browser. That's the app, running from WSL.

- `bun run dev:local` is the all-in-one for the WSL setup (DB, Redis, tunnels, Next.js).
- Plain `bun run dev` runs just the Next.js dev server (use once your DB/Redis are already up).
- First run is slow (it builds the DB and compiles). Later runs are fast.

→ If anything fails, the **[Local Dev Setup](../operations/local-dev-setup.md)** guide has the
troubleshooting section (Docker not running, tunnel auth, port conflicts).

---

## 8. The daily git workflow

Never commit straight to `v2`. Every change is a branch → PR.

```bash
git checkout v2 && git pull          # start from latest
git checkout -b feat/my-thing        # new branch, descriptive name

# ...edit code in VS Code...

bun run lint                         # catch obvious issues
bun run test                         # run tests if you touched logic

git add -p                           # review changes hunk by hunk
git commit -m "feat: short description of what changed"
git push -u origin feat/my-thing     # then open a PR on GitHub
```

Commit messages: short, present tense, prefix with `feat:` / `fix:` / `refactor:` / `docs:`.
See **[Contributing Guide](contributing.md)** for the full PR checklist and code standards.

---

## 9. Hard rules (memorize these)

These come from `CLAUDE.md` — breaking them can crash the server or production data.

- **Use `bun` only.** Never `npm`, `yarn`, or `pnpm`. The lockfile is `bun.lock`.
- **Never run a global typecheck** — `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`. They
  can eat all the RAM and crash the machine. Use the scoped ones (`bun run typecheck:ui`, etc.) or just
  rely on `bun run dev`'s live errors.
- **Database write commands are guarded.** `db:migrate`, `db:push`, `db:reset` are blocked. Don't reach
  for the `:force` variants on production unless the lead is directing you.
- **Code lives in the WSL/Linux filesystem**, never `/mnt/c/...`.
- **Secrets never go in git.** `.env*` files are ignored — keep them that way.
- **The middleware file is `src/proxy.ts`** (not `middleware.ts`) — surprises people; don't "fix" it.
- **Active branch is `v2`**, not `main`.

---

## 10. Where things are / where to go next

| You want to… | Look at |
|---|---|
| Understand the architecture | `arch.md`, `docs/architecture/` |
| Understand the project rules | `CLAUDE.md` (project root) — read it fully |
| Set up the dev environment in detail | [docs/operations/local-dev-setup.md](../operations/local-dev-setup.md) |
| Know PR / test expectations | [docs/processes/contributing.md](contributing.md) |
| Find an API endpoint | `src/server/api/routers/` (registered in `root.ts`) |
| Find UI components | `src/components/` |
| Understand "IxTime" (game time) | `src/lib/ixtime.ts` |
| See how deploys work (later) | [docs/operations/deployment.md](../operations/deployment.md) |

### Your first week, suggested order
1. Get the app running (§7) and click around the real UI at localhost:3000.
2. Read `CLAUDE.md` and `README.md` end to end.
3. Skim `arch.md` to learn the import-direction rules (UI → API → domain → infra).
4. Pick a tiny starter issue from the lead, make the change, open your first PR (§8).
5. Ask questions early and often in Discord — that's expected, not a failure.

---

## 11. Dev fundamentals (survival skills)

The rest of this guide assumes you can drive a terminal and an editor. If you can't yet, here's the
minimum. Don't memorize — keep this open and refer back.

### Using the terminal (bash, in WSL)

You spend a lot of time here. The mental model: you're always "in" one folder (the *working
directory*), and commands act relative to it.

| Command | Does |
|---|---|
| `pwd` | print where you are |
| `ls` / `ls -la` | list files / list all incl. hidden + details |
| `cd foo` / `cd ..` / `cd ~` | enter `foo` / go up one / go to home |
| `cat file` / `less file` | print a file / scroll a file (`q` to quit) |
| `mkdir foo` / `rm file` / `cp a b` / `mv a b` | make folder / delete / copy / move(rename) |
| `code .` | open the current folder in VS Code |
| `clear` | wipe the screen |

Tips that save hours:
- **Tab completion** — start typing a name, hit `Tab`, the shell finishes it. Use constantly.
- **Up arrow** — recall previous commands.
- **`Ctrl+C`** — stop a running command (e.g. kill the dev server). **`Ctrl+L`** — clear screen.
- A trailing `&` or a long-running command (like `bun run dev`) **takes over the terminal** — that's
  normal, it's the server running. Open a *second* terminal tab for other commands.
- `rm` has **no undo and no trash**. Double-check before deleting. Never `rm -rf` something you're unsure of.

### The core loop: edit → save → see

Web dev is a tight feedback loop:
1. Edit a file in VS Code and **save** (`Ctrl+S`).
2. The dev server (`bun run dev:local`) auto-recompiles — this is **hot reload / HMR**.
3. The browser at localhost:3000 updates on its own (usually within a second).
4. Look at the result. Repeat.

If the page doesn't update: check the **terminal running the server** for a red error, and the
**browser console** (next section). 90% of "it's broken" is one of those two telling you exactly what's wrong.

### Reading error messages (your most important skill)

Errors look scary but are usually precise. Read them **top to bottom, slowly**:
- The **first line** is usually the actual problem ("Cannot read property 'x' of undefined").
- The **file path and line number** (e.g. `src/components/Foo.tsx:42`) tells you exactly where — click it.
- The rest (the *stack trace*) is the chain of calls that led there; you can often ignore the lower half.
- TypeScript errors appear in the editor (red squiggle — hover it) **and** in the terminal as you save.
  They mean "the types don't line up" — fix the types, don't reach for `any`.

When stuck, **copy the first line of the error** and search it (the web, the codebase, or ask). You are
almost never the first person to hit a given error.

### Browser DevTools (F12)

In your browser, press **F12** to open DevTools. The two tabs you'll live in:
- **Console** — JavaScript errors and `console.log(...)` output. If the UI misbehaves, look here first.
- **Network** — every request the page makes. Use it to see if an API call failed (red = error, click
  it to see the response). Our API calls go to tRPC endpoints; a failing one shows here.

`console.log("got here", someVariable)` sprinkled in code is a completely legitimate way to see what's
happening. Remove them before committing.

### Reading a codebase (you read far more than you write)

- Don't try to understand everything. To change one thing, you only need to understand *that path*.
- **Search is your friend.** In VS Code, `Ctrl+Shift+F` searches all files. Search for a button's text,
  an error string, or a function name to find where things live.
- **Follow the imports.** At the top of a file, `import { X } from "..."` shows you where `X` is defined.
  In VS Code, `Ctrl+Click` (or `F12`) on a name jumps to its definition. `Shift+F12` finds all usages.
- Match the surrounding code's style when you add to it — naming, structure, formatting. Consistency
  over personal preference.

### Git, when it goes wrong (it will)

- **`git status`** — your most-used command. "What have I changed, what branch am I on?" Run it constantly.
- **`git diff`** — see your uncommitted changes line by line.
- Made changes on the wrong branch / want to undo *uncommitted* edits to a file:
  `git restore <file>` (throws away your changes to it — careful).
- "I committed but want to keep editing": just keep editing and commit again; or `git commit --amend`
  to fold into the last commit (only if you haven't pushed/shared it).
- **When git scares you, stop and ask before running anything with `--force`, `reset --hard`, or
  `clean`.** Those can delete work. A normal `add`/`commit`/`push` never loses anything.

### Getting unstuck (the meta-skill)

1. **Read the error** (top line + file:line). Most answers are right there.
2. **Reproduce it small** — what exact action triggers it?
3. **Check the obvious**: did you save? is the server running? right branch? did `bun install` after a `git pull`?
4. **Search** the error text.
5. **Ask** — in Discord, with: what you were doing, the exact error (paste it), and what you already tried.
   A good question with the error pasted gets answered fast. Don't suffer silently for an hour — that's
   the one actual mistake.

---

## 12. How web dev works (mapped onto IxStats)

This is the conceptual map. Read it once and the rest of the codebase stops looking like alphabet soup.

### JavaScript, and where it runs

A web app is code that runs in **two different places**:
- **In the browser** (the user's Chrome/Firefox) — draws the UI, responds to clicks. Historically the
  only place JavaScript ran.
- **On a server** (a computer we control — for us, the `ixwiki` box) — talks to the database, enforces
  rules, sends pages to the browser.

The language for both is **JavaScript**. On the server, JavaScript runs inside a **runtime** — classically
**Node.js**, and for us **bun** (a faster Node-compatible runtime). So "bun" is two things: the program
that *runs* our server code, and the tool that *installs* our dependencies.

**TypeScript** is JavaScript plus types. You write `.ts`/`.tsx` files where every value has a declared
shape (a number, a string, a `Country` object). Before running, it's *compiled* down to plain
JavaScript. The payoff: the editor catches whole classes of mistakes (typos, wrong argument, missing
field) **as you type**, before the code ever runs. That red squiggle is TypeScript doing its job.

### Packages, package.json, and bun

Nobody writes everything from scratch. The **npm ecosystem** is a giant public library of reusable
code ("packages") — React, Next.js, Prisma are all packages. Our app declares which ones it needs in
**`package.json`** (the project's manifest: dependencies + the `scripts` you run like `bun run dev`).

- `bun install` reads `package.json`, downloads every package (and *their* dependencies) into a
  **`node_modules/`** folder. That folder is huge, machine-specific, and **never committed to git**.
- **`bun.lock`** records the *exact* versions installed, so everyone on the team gets an identical setup.
  This file **is** committed.
- **Why bun and not npm here?** Same job, much faster, and we standardized on it. Mixing tools corrupts
  the lockfile — that's why the hard rule in §9 is *bun only*.
- Rule of thumb: after a `git pull` that changed `package.json`, run `bun install` again.

### Frontend vs backend, and how a request flows

The split, in our terms:

```
  BROWSER (frontend)                 SERVER on ixwiki (backend)              DATABASE
  React components  ── tRPC call ──▶ tRPC router ──▶ domain logic ──▶ Prisma ──▶ PostgreSQL
  (what the user sees)               (the API)        (the rules)     (DB access)   (the data)
        ▲                                                                              │
        └───────────────────── data comes back the same way ◀──────────────────────────┘
```

Walk through one real action — *a user opens their country page and it shows population*:
1. **React** ([src/components/](../../src/components/)) renders the page in the browser and needs data.
2. It makes a **tRPC** call — think of tRPC as type-safe function calls that hop from browser to server.
   The matching endpoint lives in [src/server/api/routers/](../../src/server/api/routers/).
3. The router runs the **domain logic** (the business rules) and asks for data via **Prisma**.
4. **Prisma** is the translator between our code and the database — instead of writing raw SQL, we call
   `prisma.country.findMany(...)` and Prisma generates the SQL against **PostgreSQL** (the actual data
   store, running in Docker — locally on your machine, on the server in production).
5. Data flows back up the same chain into the React component, which renders the number on screen.

Because it's tRPC + TypeScript end to end, the *type* of that country data is the same in the database,
the API, and the UI — change a field's shape in one place and the editor flags every place that needs
updating. That's the whole reason this stack is pleasant.

### Next.js ties it together

**React** alone only does the browser UI. **Next.js** is the framework wrapping everything: it serves
pages, handles URLs/routing (a file at `src/app/mycountry/page.tsx` *becomes* the `/mycountry` URL),
and runs both the frontend and backend halves. When you run `bun run dev`, Next.js is the thing that
compiles your TypeScript, serves the site at localhost:3000, and hot-reloads on save.

- **Routing by folders:** `src/app/<path>/page.tsx` → the page at `/<path>`. This is "App Router."
- **Styling:** **Tailwind CSS v4** — instead of separate stylesheet files, you put utility classes
  right in the markup (`className="flex gap-2 text-gold"`). Our design system on top of it is called Facet.

### Dev mode vs build/production (why there are two of everything)

- **Dev** (`bun run dev:local`): optimized for *you* — recompiles instantly, shows detailed errors, hot
  reload. Slower and not secure; never user-facing.
- **Build + production** (`bun run build`, then `start:prod`): compiles the whole app once into an
  optimized bundle, then serves it fast. This is what runs on the server at port 3550 under **PM2** (a
  process manager that keeps it alive and restarts it if it crashes — `pm2 list` on the server shows it).

You'll work in dev 99% of the time. You generally don't deploy; the lead does. See
[deployment.md](../operations/deployment.md) when that day comes.

### The one-paragraph summary

You write **TypeScript** in **React** components and **tRPC** routers. **Next.js** compiles and serves
them. **bun** installs the packages (listed in `package.json`, locked by `bun.lock`) and runs the
server code. **Prisma** talks to **PostgreSQL** for the data. In dev it all runs on your machine via
**WSL + Docker**; in production the same code runs on the **ixwiki** server under **PM2**. Everything
else is detail you'll pick up by reading code.

---

*Last updated: June 2026. If a step here is wrong or out of date, fix it in the same PR as your work —
keeping onboarding accurate is everyone's job.*
