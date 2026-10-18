# Surface brief — Assignment Integrity Form (web)

## Scope and mode

Whole `web` surface: landing (`/`), Guru console (`/guru`, `/guru/tugas/$tugasId`,
`/guru/sesi/$sessionId`), and the Murid flow (`/t/$token`, `/sesi/$sessionId`).
**Mode: Operate.** The landing page is a Persuade-flavored entry point but is
scoped by the console and the Sesi; both of those are pure Operate and set the
density, navigation and control decisions for everything else.

## Audience, job, action

Two operators who never see each other's screen. **Guru** scans evidence fast and
must reach Tasks → a Murid → a Sesi in the fewest clicks. **Murid** is a nervous
student inside a locked window, where every unfamiliar control reads as a threat.
The design must make the consequence of an irreversible action legible *before*
the click, and must never make the lockdown feel arbitrary.

## Proof/content

Real content already exists and must stay: the domain vocabulary in
`CONTEXT.md`, the mock dataset in `guru-mocks.ts`, the `_SYSTEM_ID` prompt
register, ADR-0001's "deterrence, not prevention" framing. No invented
testimonials, student names, institutions, or benchmark numbers.

## Chosen direction

**GNOME Adwaita — pinned by the brief.** The user explicitly pinned the GNOME
HIG design system, so the concept-seed roll (`key 31f6a435`, assigned index 7) was
acknowledged and overridden: a user-pinned world beats the roll. Every judgment
call below is made *inside* Adwaita, not by substituting another world.

Adwaita is already an operating-system design language rather than a costume, so
the Operate rule that a world may lend only type, palette, density and one
signature move is satisfied by taking Adwaita's type scale, tonal surface
structure, state palette, density, and the OSD/progress-bar grammar — while
navigation and controls stay standard web primitives (TanStack Router links,
real `<button>`, `<input>`, `<table>`-free column views, GNOME patterns wrapped
around them).

## Signature move: the **Integrity Rail**

The Sesi state machine drawn as a continuous vertical rail. Every Sesi — on the
Guru's detail page, collapsed to three nodes in a participant row, or inside the
attempt history — is one vertical spine whose nodes are the five session states
(`created → generating → answering → submitted|auto_submitted`), filled as far as
the session actually reached, and never re-laid-out as the status changes. Every
Pelanggaran is stamped onto the rail as a `dialog-warning-symbolic` mark at its
server timestamp, so "when did this go wrong relative to the work" is read as a
position on a line rather than re-computed from a list.

The rail is what makes the audit trail visible at a glance. It is also the one
element that carries the world: Adwaita supplies the palette the nodes use
(grey / blue / amber / green / red), and the symbolic icon language of the marks.

## Direction contract

**THESIS.** The incumbent is the category default and nothing more: a grey screen,
one black accent, 12px uppercase tracked labels, a `min-width: 720px` data table,
and two stacked page headers that say the same thing twice. That arrangement is
refused. Adwaita's answer is tonal structure — window / header bar / sidebar /
card are four *different* values of the same neutral, so hierarchy is carried by
the surface itself before any text is read — plus one signature move (the
Integrity Rail) that turns the state machine into something scannable.

**OWN-WORLD.** Adwaita light (`#fafafb` window / `#ffffff` view + header bar /
`#ebebed` sidebar / `#ffffff` card, fg `rgb(0 0 6 / 80%)`) and Adwaita dark
(`#222226` / `#1d1d20` / `#2e2e32` / `rgb(255 255 255 / 8%)`, fg `#ffffff`), the
full GNOME palette doing real jobs (blue `#3584e4` progress & in-progress,
green `#2ec27e` submitted, yellow `#e5a50a` warning, red `#e01b24` destructive
& auto-submit), 15px window/card radius and 9px button radius, 6px spacing
scale, Adwaita type scale (24 / 20 / 17 / 15 / 15 / 13px, no all-caps anywhere),
symbolic 16px icons at 2px stroke, hairline `1px` separators with no second
shadow layer.

**STORY.** A Guru lands and knows within one screen how many Murid are in, how
many Pelanggaran exist, and where to click next — the refresh control and its
"last loaded" time are visible because there is no realtime channel. A Murid
reads the locked Sesi and understands, before anything is irreversible, that the
upload happens once, that the timer starts after it, and that leaving the window
costs five seconds and then the attempt. Nobody is told the system is
cheating-proof; Penilaian AI is framed as a signal in every surface it appears in.

**FIRST VIEWPORT.** One header bar, full width, 60px tall, `1px` bottom hairline:
back button at start when the view is a child, window heading centered, primary
menu and account at end, and always a stretch of empty space for dragging. Below
it a content column with a max width (~1100px console, ~720px Murid) so text
never runs long. Guru list: the heading and the `suggested` action on one line,
then boxed lists — not a horizontally scrolling table. Sesi detail: two columns
at ≥1000px, stacked below. Murid Sesi: the answer timer as a **thin progress bar
attached to the bottom edge of the header bar** — the GNOME pattern for
background progress — with the remaining time set in tabular figures at the end.

**FORM.** Adwaita, carried from the pinned brief rather than from the roll. Its
native moves are reused rather than imitated: header bar with three alignment
points, boxed lists with row separators, view switcher replacing the underlined
tabs, alert dialogs with cancel-before-affirm, banners for persistent state,
placeholder pages for empty states, OSD for the countdown overlay, and the thin
header-bar progress bar for the timer.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
