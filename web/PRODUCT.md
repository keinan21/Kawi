# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Guru** (primary operator of the console): a course instructor who has given a
real assignment and needs evidence that the submitted work is the Murid's own.
They work from a laptop, in bursts, usually after a deadline rather than during
class. Their job is to create a Tugas, share its link, then read the evidence —
attempt history, Pelanggaran log, Penilaian AI — and decide whether to grant Izin
Unggah Ulang. They are not a data analyst; they scan.

**Murid**: a student who received a link from the Guru and has to submit one PDF
or PPT and answer three AI questions about it inside a locked session. They are
nervous. The session punishes tab-switching with a 5-second countdown that can
end the attempt, so every piece of the interface is read as a threat until it is
understood.

Both are Indonesian-speaking university students and staff. Copy is Bahasa
Indonesia throughout; domain terms are the capitalized ones fixed in
[CONTEXT.md](../CONTEXT.md) (Guru, Murid, Tugas, Sesi, Pelanggaran, Unggahan,
Izin Unggah Ulang, Pertanyaan Ideasi/Isi/Harapan, Penilaian AI).

## Product Purpose

Replace "submit a file and hope" with "submit a file and demonstrate
understanding". A Guru distributes a link, a Murid uploads exactly one document
inside a locked Sesi, and the AI asks three questions grounded in that document —
Ideasi (is the idea yours), Isi (did you actually do it), Harapan (do you have a
vision for it). The Guru gets an audit trail plus an assistive Penilaian AI and
remains the only real grader.

Success for the product is not engagement: it is a Guru being able to answer
"whose work is this?" in under a minute, and a Murid finishing the Sesi without
being frightened off by the interface itself.

## Positioning

The mechanism nobody else truthfully claims: the questions are *grounded in the
student's own uploaded document* (each carries an `evidence` quote verified by
substring check against the extracted text), and the lockdown is **deterrence plus
audit trail, not prevention** (ADR-0001). Proctora-class products record whether
a student *could* have cheated; this one asks a question only the actual author
can answer, and shows the Guru the trail without ever claiming to have stopped
anything.

Consequence for design: the UI must never let a Murid believe the system is
cheating-proof, and must never let a Guru believe a clean log is proof of
honesty. The Penilaian AI is framed as a *signal*, never a verdict, in every
surface where it appears.

## Operating Context

- Entry is always a link or a split-by-role landing page, never a search. Murid
  arrives holding a pasted `…/t/<kode>` URL or a bare kode; Guru arrives cold.
- The Murid Sesi is desktop-only by deliberate design (DESIGN.md §7): fullscreen
  is mandatory, input is blocked, tab-switching is detected, and a viewport that
  is too narrow is refused at the door with a "Buka di laptop" gate.
- The Guru console has **no realtime channel** — it is manual refresh only
  (DESIGN.md §10, SSE explicitly deferred). Refresh controls and "last loaded"
  timestamps are therefore part of the real workflow, not decoration.
- Historical attempts are evidence and are never deleted. Izin Unggah Ulang adds
  attempt N+1 and leaves the old questions and answers in place.
- Two data modes exist in this repo: `VITE_USE_MOCKS=true` demo data (used for
  competition demos) and the real REST API. Both must look finished; the demo
  banner is a real UI state, not a leftover.

## Capabilities and Constraints

- Round trip: create Tugas → share link → Murid logs in with Google (Clerk) →
  locked Sesi → one-shot Unggahan (PDF/PPT, ≤ 2 MB, MIME allow-list validated
  before persist) → 10-minute answer timer that starts *only* after the upload
  succeeds → AI generates exactly 3 questions grounded in the document → Murid
  answers → Penilaian AI runs asynchronously → Guru reviews.
- Session state machine: `created → generating → answering → submitted`, plus
  `auto_submitted` when a Pelanggaran countdown is ignored or the timer expires.
  Terminal states require a Guru-issued Izin Unggah Ulang to reopen.
- Proctor contract: `tab_switch`, `window_blur`, `fullscreen_exit` raise the
  5-second countdown; `copy/paste/context_menu/shortcut` events are recorded
  immediately; `multi_tab` is detected via BroadcastChannel. Server owns
  `server_ts`. Client and server both dedupe. Do not add aggressive detection
  (screenshot, mouse) without a new ADR.
- Murid **never** sees a score. `GET /api/sessions/:id/status` returns status
  only; `evidence` is stripped from every Murid payload. This is a contract, not
  a display choice, and the UI must not leak it.
- Two wire conventions coexist by design: Guru endpoints are camelCase, Murid
  endpoints are snake_case. Do not "fix" this in UI code.
- Copy facts that must not drift: `Penilaian AI` is internal and confidential to
  the Guru; the answer timer starts after the Unggahan is accepted, never before;
  re-upload needs a Guru permission; the desktop-only gate is a product rule.
- Undecided / explicitly out of scope for now: multi-Guru management, email
  notifications, Murid-initiated permission requests, report export,
  SSE/WebSocket realtime, object storage, codegen for the shared type contract.

## Brand Commitments

- Name: **Assignment Integrity Form**. Sub-label used in the console: "Konsol
  Guru". Copy register is plain Indonesian, short sentences, no hype, no
  gamification vocabulary, no score-chasing language.
- **Binding design-system commitment (set by the user, 2026-10-15):** the entire
  interface follows the **GNOME Human Interface Guidelines** and the **Adwaita**
  visual language — Adwaita palette, GNOME typographic scale and font styles,
  GNOME patterns (header bars, boxed lists, dialogs, banners, placeholders,
  progress indicators), light + dark style, symbolic icons, standard keyboard
  shortcuts. This is not a suggestion or a mood; future work on `web/` extends
  Adwaita rather than inventing another system.
- Never position the lockdown as foolproof; never use copy implying the AI is the
  grader.

## Evidence on Hand

- `packages/shared` + `web/src/proctor` — the real taxonomy and event contract.
- `web/src/lib/guru-mocks.ts` — a complete, realistic demo dataset (Tugas list,
  participants with mixed statuses, Pelanggaran logs, Penilaian AI scores).
- `docs/adr/0001-deterrence-audit-trail-not-prevention.md` — the decision that
  governs every word the product says about itself.
- The `_SYSTEM_ID` prompts in `api/agents/prompts/` establish that the AI's
  register is Bahasa Indonesia.
- No real students, no real submissions, no testimonials, no institutional
  logos, no usage telemetry, no benchmark numbers exist. Any future surface must
  not fabricate them. Demo-mode data is labelled as demo data in the product
  itself.

## Product Principles

1. **Say the consequence before the action.** Every irreversible action in this
   product has a stated consequence attached to it (one-shot upload, locked
   session, auto-submit). The UI's job is to make the consequence legible before
   the click, not to scold afterwards.
2. **The countdown is a dialog, the lockdown is a mode.** Disturbance to the
   Murid is handled through one focused interruption with a single way out;
   everything else is ambient.
3. **Signals, not verdicts.** Penilaian AI, Pelanggaran counts and status badges
   are advisory. They inform the Guru's judgement and never replace it, and the
   wording of every surface must keep that true.
4. **Reduce effort before adding explanation.** The Guru's common loop is
   Tasks → a Murid row → a Sesi. That loop should be the shortest possible path;
   explanation lives where it is asked for.
5. **The audit trail is the product.** Nothing that happened is allowed to become
   invisible — hence the manual refresh affordance, the "last loaded" timestamp,
   and complete attempt history.

## Accessibility & Inclusion

- Target: GNOME HIG accessibility expectations — every action reachable by
  keyboard alone, visible focus on every interactive element, descriptive
  accessible names, and text that survives Large Text mode. No information
  conveyed by colour alone (status is always label + shape + text).
- Both a light and a dark style must be correct, following the system preference
  by default.
- Pointer targets sized for low precision; no double-click-only or right-click-only
  actions.
- **Documented product exception:** the locked Sesi is desktop/laptop-only and
  deliberately refuses narrow viewports. This is a deliberate product decision
  (DESIGN.md §7), not an oversight, and the refusal page must explain it warmly
  rather than erroring. Every other surface (landing, Guru console) is fully
  adaptive down to 360 px.
