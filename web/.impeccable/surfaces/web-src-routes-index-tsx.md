---
version: 1
slug: "web-src-routes-index-tsx"
primary_target: "web/src/routes/index.tsx"
related_targets: []
---

# Halaman awal (route `/`)

## Scope and mode

Surface: the public landing route, `web/src/routes/index.tsx`. Mode: **Persuade** —
the visitor decides and acts. Not Operate: the Guru console and the Murid Sesi own
their own surfaces and are unchanged by this brief.

## Audience, job, action, proof, constraints

- **Audience.** A university Guru arriving cold, usually after a deadline, with one
  question they cannot answer honestly: *whose work is this?* A secondary Murid
  audience arrives holding a pasted `…/t/<kode>` link and wants to get inside.
- **Job.** Understand what the product asks, and why it differs from anti-cheating
  theatre, in one viewport.
- **Action the visitor came to take.** Open the Guru console. Secondarily: open a
  Tugas by link. Both are present in the first viewport in working form — the
  console as the primary CTA, and a link field that actually resolves the token.
- **Proof.** No testimonials, no customer counts, no benchmark numbers, no
  institutional logos exist (PRODUCT.md, *Evidence on Hand*). Proof is therefore
  **demonstrated, not claimed**: the three questions and their evidence quotes, the
  locked session, and the Integrity Rail with a Pelanggaran stamped on it.
- **Constraints.** Bahasa Indonesia, plain register, no hype, no gamification
  vocabulary. Never imply the lockdown is foolproof; Penilaian AI is always a
  signal, never a verdict (ADR-0001). Landing stays adaptive to 360 px; only the
  locked Sesi is desktop-only.

## Direction

**The page sells the question, not the lockdown.** Competitor landings lead with
anti-cheating theatre — locks, shields, "AI proctored". This one leads with the
mechanism nobody else truthfully claims: the AI pulls three questions out of the
student's *own uploaded file*, each carrying an exact quote verified by substring
check. The category default (headline → row of equal icon cards → testimonial grid
→ CTA) is refused; persuasion comes from showing the Sesi and from exhaustive
honesty about what the product does not claim.

**Memorable moment.** The dark `.lp-osd` Session panel in the hero — the only dark
surface on the page, appearing exactly once. It is what the Murid sees, and it
carries the three questions with their source lines visible. Chosen by the user
("Adwaita + panel Sesi gelap") as the one licensed deviation from pure Adwaita.

**World.** Full Adwaita, no exceptions: the five-value neutral ramp, 15px/9px
radii, 6px spacing base, Adwaita blue as the only accent, 1px hairlines as the
only elevation, Inter Var as the Adwaita Sans stand-in, symbolic icons taken from
the GNOME Adwaita theme (fill-only, `currentColor`, attributed "GNOME Project").
Feature figures are live DOM, never screenshots, so the page ships zero rasters.

## Direction contract

**THESIS.** The page sells the question, not the lockdown. Category default — hero
headline, row of equal icon cards, proof-by-testimonial, closing CTA — refused:
persuasion is carried by dramatizing the mechanism and by exhaustive honesty, not
by claims.

**OWN-WORLD.** Adwaita, fully committed. window / headerbar / view / sidebar are
five values of one neutral; 15px card radius, 9px control, 6px spacing base;
Adwaita blue `#3584e4` the only accent plus success/warning/error roles; Inter Var
as the Adwaita Sans stand-in on GNOME weight steps; 1px hairline as the only
elevation, never a shadow under a border. Symbolic icons are the GNOME Adwaita
theme's own paths, fill-only, `currentColor`, attributed "GNOME Project". Signature
device: the dark `.lp-osd` panel, used exactly once, in the hero.

**STORY.** A Guru lands cold after a deadline. In one viewport: the product asks
three questions built from the Murid's own file, the locked Sesi appears as the
Murid will see it, and the one action they came for is right there. Scrolling they
learn the round trip, then that the AI is a signal and they remain the grader,
then they act.

**FIRST VIEWPORT.** Sticky header bar — logo left, three anchor links, `Masuk`
quiet plus `Buka Konsol` suggested right. Below it a two-column hero on a 1200px
measure: left ~52% carries H1 at 3.4rem / 1.06 / -0.025em tracking, one 56ch
paragraph, then the CTA pair (`Buka Konsol Guru` suggested, `Masuk` quiet) plus
the Murid's working link field; right ~48% carries the dark Session panel holding
the lock chip, the answer-timer bar and the three question cards with source
lines. Under both, a three-commitment strip — grounded / history never deleted /
AI only a signal — with no numbers anywhere.

*As built, two adaptations to this block:* the commitment strip sits inside the
left column under the actions rather than spanning both, and the panel sizes to
its content instead of a fixed 4:5 box. Both read as intended; neither weakens
the promise.

**FORM.** Chosen form: the marketing skeleton — sticky nav, hero, alternating
feature rows with product visuals, role section, honesty band, closing CTA, dense
footer. Third of seven grounded structures; selected by the user over the
concept-seed roll. Seed key `07296f90`. Code-led.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Unresolved

- `.adw-dim` (the platform's caption tone) composites to ~3.2:1 on the window
  ground. The landing avoids it for prose via `.lp-dim` (~5.3:1 light / ~8.9:1
  dark). The console still uses `.adw-dim`; reconciling it is separate work and is
  not done. Recorded in DESIGN.md §11.
- Sign-in goes through the app's `/masuk` route with a `redirect` query, not
  Clerk's overlay. The landing's four call sites were migrated mid-build; the
  convention is now `/masuk` everywhere.
- The detector's `overused-font` finding on Inter is declined on purpose: Inter is
  Adwaita Sans's ancestor and PRODUCT.md's design-system commitment is binding.
- Wayground-style sticky in-section sub-navigation was considered and left out;
  the header bar's three anchors carry the navigation instead.
