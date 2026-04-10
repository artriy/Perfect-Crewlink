# Docs Style Guide

This file is the house style for the **Perfect Crewlink** README and release changelogs.

The goal is simple: keep the docs looking sharp, intentional, and consistent with the current project identity.

---

## Core Rule

- The **README** is an evergreen product page and build guide.
- The **CHANGELOG / GitHub release notes** are release-specific and should only talk about what changed in that release.
- Do not copy full old release sections forward into a new patch release.

---

## README Rules

### Purpose

The README should:

- sell the project immediately
- explain what Perfect Crewlink is
- show why it is better / different
- make setup and building easy to follow

The README should **not**:

- read like patch notes
- list version-by-version history
- talk too much about old naming history
- feel like a dump of raw feature bullets with no visual structure

### Visual Style

- Open with a strong hero section in centered HTML.
- Use the current visual language:
  - `static/images/header-banner.svg`
  - `static/images/divider.svg`
  - badges with strong color contrast
  - centered logo / badges / call-to-action row
- Keep the page visually broken into sections with divider images.
- Prefer clean tables/cards for grouped feature explanations.
- Keep the top section attractive, but not overloaded with too many random badges.

### Content Shape

Recommended README order:

1. Hero banner
2. Short project pitch
3. Why Perfect Crewlink
4. Feature sections
5. Screenshots or visual previews if available
6. Build / setup guide
7. Useful links

### Writing Tone

- Confident, polished, product-like
- Short paragraphs with high signal
- Specific benefits over vague hype
- Use strong verbs like `rebuilt`, `improved`, `sharpened`, `streamlined`, `stabilized`

Avoid:

- apologetic wording
- filler like `this project aims to`
- awkward AI-sounding repetition
- calling normal features `revolutionary`

### Versioning

- Do not put release-version commentary in the README body.
- Avoid README copy like `as of v1.0.0` unless there is a real long-term reason.
- The README footer should stay generic and evergreen.

---

## Changelog / Release Rules

### Purpose

Release notes should:

- look attractive
- feel premium and polished
- explain only the changes for that release

Release notes should **not**:

- duplicate the README
- retell the full project history on every patch
- include sections from earlier releases unless they changed again in this release

### Visual Style

Use the same visual family as the current release notes:

- animated capsule banner at the top
- `static/images/divider.svg` between major sections
- strong release badge header
- grouped sections with short framed intros
- packaging card near the bottom
- `static/images/footer.svg` closing block

For GitHub release pages:

- replace local `static/images/...` paths with raw GitHub URLs so images render correctly

### Content Shape

Recommended release-note order:

1. Hero/banner
2. Release badge + date/status/scope
3. One short release summary paragraph
4. Only the sections relevant to that release
5. Packaging card
6. Footer

### Section Rules

- Group changes by outcome, not by file names.
- Each section should have:
  - a short title badge
  - a one-paragraph framing sentence
  - a short bullet list
- Patch releases should stay tight and focused.
- Major releases can have broader sections.

### Patch Release Rule

For patch releases like `v1.0.1`:

- only include the delta since the last release
- keep old launch material out
- do not repeat baseline platform/features unless the packaging itself changed
- it is fine to keep the packaging card if it helps presentation

### Writing Tone

- Product-quality, not dev-log quality
- Cleaner than raw commit notes
- Concrete, not vague
- Attractive, but still accurate

Good pattern:

- `Fixed alt-tab overlay desync that could highlight the wrong player`
- `Improved retry handling for transient lobby-code lookup failures`

Bad pattern:

- `Various fixes`
- `Improved stuff`
- `Many under the hood changes`

---

## Asset References

Current preferred assets:

- README hero: `static/images/header-banner.svg`
- Section divider: `static/images/divider.svg`
- Footer art: `static/images/footer.svg`
- Main logo block: `static/images/logos/sizes/256-BCL-Logo-shadow.png`

If these change later, update this guide too.

---

## Copy Rules To Preserve

- README = evergreen attraction + build guide
- Release notes = beautiful, release-specific delta
- Keep strong visual hierarchy
- Keep the packaging card
- Keep the writing crisp and product-like
- Prefer quality over length

---

## Before Publishing Docs

For README changes:

- check that local asset paths render in GitHub
- check spacing and section order
- make sure no release-specific wording leaked in

For release notes:

- verify the body only contains the current release delta
- convert local image paths to raw GitHub URLs
- verify asset names match the actual uploaded files
- make sure the release title and badges match the real version/date
