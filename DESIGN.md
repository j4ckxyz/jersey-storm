---
name: Jersey Storm Tracker
description: A calm, sourced live tracker for storms in Jersey and Guernsey, where only the warnings are loud.
colors:
  channel-blue: "#0a66c2"
  channel-blue-night: "#82b9f2"
  warning-red: "#d0021b"
  warning-red-night: "#f17776"
  warning-red-tint: "#fdecee"
  warning-amber: "#e86a00"
  warning-amber-night: "#f4a859"
  warning-amber-tint: "#fff3e6"
  warning-yellow: "#e6b800"
  warning-yellow-night: "#edd473"
  warning-yellow-tint: "#fff9e0"
  live-green: "#16a34a"
  live-green-night: "#68ca80"
  sea-mist: "#f6f7f9"
  paper: "#ffffff"
  sea-mist-deep: "#f0f2f5"
  harbour-ink: "#0f1419"
  slate: "#5b6673"
  hairline: "#e3e7ec"
  hairline-strong: "#d3d9e0"
  graphite-night: "#15171b"
  graphite-surface: "#1e2125"
  graphite-raised: "#282c30"
  night-text: "#e5e8ec"
  night-slate: "#a6abb2"
  night-hairline: "#2b2e32"
  night-hairline-strong: "#3a3d42"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 750
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  item-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 650
    lineHeight: 1.3
  meta:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.harbour-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  event-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.harbour-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px 14px 16px"
  button-icon:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.harbour-ink}"
    rounded: "{rounded.full}"
    size: "38px"
  chip-filter:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.harbour-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "34px"
    padding: "0 12px"
  chip-filter-selected:
    backgroundColor: "{colors.harbour-ink}"
    textColor: "{colors.sea-mist}"
    rounded: "{rounded.full}"
    height: "34px"
    padding: "0 12px"
  gust-chip-red:
    backgroundColor: "{colors.warning-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 12px"
  badge-warning-red:
    backgroundColor: "{colors.warning-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  warning-row-red:
    backgroundColor: "{colors.warning-red-tint}"
    textColor: "{colors.harbour-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  new-pill:
    backgroundColor: "{colors.channel-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "8px 16px 8px 12px"
  posts-toggle:
    textColor: "{colors.slate}"
    rounded: "{rounded.md}"
    height: "44px"
  nav-tab-active:
    textColor: "{colors.channel-blue}"
    rounded: "{rounded.full}"
---

# Design System: Jersey Storm Tracker

## Overview

**Creative North Star: "The Harbour Noticeboard"**

The tracker is a trusted local noticeboard that neighbours check during a storm. Everything on it is pinned up plainly, in date order, with its source attached. The board itself is quiet: soft sea-mist paper, hairline edges, the device's own system typeface. Whatever is pinned to it can then speak at the right volume. The only loud things are the official warnings, in Jersey Met's red, amber and yellow. A red warning has to read as red because nothing else on the page competes with it.

The feel is a calm news app with the polish of a well-made native weather app: big numerals where a number is the news, generous line height, sentence-case labels and soft surfaces. Components are **quiet and tactile**. Surfaces barely lift, controls give a small press response, and motion only shows something changing (a filter moving cards, a panel opening, a theme switching). Nothing loops for attention, and nothing plays on page load.

It's rejected as a generic SaaS dashboard (a grid of stat tiles, glassy chrome) and as tabloid or alarmist (flashing red, sirens, shouting capitals).

**Key Characteristics:**
- Quiet neutral surfaces, so the official warning colours are the only loud colour.
- One system typeface family carries everything. Hierarchy comes from size and weight, not from a second font.
- Big tabular numerals for wind speeds, and sentence-case labels everywhere else.
- Hairline borders, with a faint ambient shadow in light mode. Dark mode is flat and layered by tone.
- Short ease-out motion that explains a change of state, and is cut back when reduce motion is on.
- Light and dark themes are equal partners. They follow the system by default, and there's a manual toggle.

## Colors

A cool sea-mist neutral base, one Channel Blue accent for interaction and live state, and Jersey Met's warning colours reserved for severity.

### Primary
- **Channel Blue** (`channel-blue`, night: `channel-blue-night`): links, focus rings, the selected mobile tab, the "new updates" pill, source reference chips and the text-selection tint. It means "this is interactive" or "this is live", and never "this is dangerous".

### Secondary
- **Warning Red, Amber and Yellow** (`warning-red`, `warning-amber`, `warning-yellow`, plus their `-night` and `-tint` variants): only for Jersey Met warning colours and gust severity. Their uses are the badge, the warning row's tinted fill and border, the header gust chip, the gust numerals, the forecast bars, and the dot beside "Major" or "Notable" on events. In light mode, badges and chips are solid with white or dark ink. In dark mode they become a 20% tint with coloured text, and the hues are softened (for example `warning-red-night`).

### Tertiary
- **Live Green** (`live-green`, night: `live-green-night`): the pulsing "Live" dot and healthy-source indicators. It means "connected", and isn't used for anything else.

### Neutral
- **Sea Mist** (`sea-mist`): the page background in light mode.
- **Paper** (`paper`): cards, panels and controls in light mode.
- **Deeper Sea Mist** (`sea-mist-deep`): stat tiles, type badges, skeletons and subtle hover fills.
- **Harbour Ink** (`harbour-ink`): body text, and the selected filter chip's fill.
- **Slate** (`slate`): secondary text, metadata, small labels and chevrons. It keeps at least 4.5:1 contrast on Paper.
- **Hairline / Strong Hairline** (`hairline`, `hairline-strong`): card edges and dividers, and the hover edge.
- **Graphite Night, Surface and Raised** (`graphite-night`, `graphite-surface`, `graphite-raised`): the dark-mode background, cards and inset fills. It's a soft graphite, deliberately not pure black.
- **Night Text and Night Slate** (`night-text`, `night-slate`) with **Night Hairlines** (`night-hairline`, `night-hairline-strong`): the dark-mode equivalents of the light neutrals above.

### Named Rules
**The Only-Warnings-Shout Rule.** Red, amber and yellow appear only when Jersey Met's data puts them there: a warning colour, a gust threshold (≥70 mph red, ≥50 amber, ≥40 yellow) or an event's severity. Decorative uses, error-coloured headings and red badges for emphasis are all forbidden.

**The Blue-Means-Touch Rule.** Channel Blue marks what can be tapped or what is live. Don't use it as a section colour or a background wash.

## Typography

**Display Font:** the system UI face: SF Pro on Apple devices, Segoe UI Variable on Windows, Roboto on Android. Fallbacks are Helvetica Neue and Arial.
**Body Font:** the same family.

**Character:** a single native family that feels at home on every device and costs nothing to download. Personality comes from weight steps (400 / 550 / 650 / 700 / 750–800) and tight tracking on large sizes, not from a display face.

### Hierarchy
- **Display** (750, 3.4rem, 0.95, −0.03em, tabular figures): the forecast panel's maximum-gust numeral. It's the one number that is the news.
- **Headline** (700, 1.75rem, or 1.5rem on phones, 1.15, −0.025em, balanced wrapping): the "Right now" line, for example "Gusts up to **85 mph** tomorrow morning". The number inside it is 800 weight, in its severity colour.
- **Title** (700, 1.2rem, −0.015em): section headings such as "What's happening", "Latest updates" and "Forecast".
- **Item title** (650, 1rem, 1.35): event, news-item and warning titles. Major events step up to 700 at 1.06rem.
- **Body** (400, 1rem, 1.5, paragraphs wrapped with `text-wrap: pretty`): the summary lead (500, 1.08rem) and bullet points, post text and event details. Supporting text is 0.92rem in Slate.
- **Label** (650, 0.85–0.95rem, sentence case, Slate): small headings such as "Right now", "On land", "At sea", "So far", "Sources" and the day headings.
- **Meta** (400, 0.78–0.8rem, tabular figures): times, sources and counts.

### Named Rules
**The Sentence-Case Rule.** Labels and headings are in sentence case. The only capitals are on Jersey Met's colour badges (RED, AMBER, YELLOW), because they quote an official classification.

**The Tabular-Figures Rule.** Any number that updates or sits in a column (times, mph, counts, temperatures) uses tabular figures, so refreshes don't make the text jitter.

## Layout

The layout is a centred column with a maximum width of 1200px and side gutters of at least 16px, respecting the safe-area insets. On desktop:
- the "Simple | Detailed" segmented control, the warning banner and the one-line "now" strip span the full width. Detailed sections (Weather now, Travel, Maps & imagery, Sources) follow in a two-column grid, only when Detailed is on;
- below it, a two-column grid has the main updates column on the left and a 380px sidebar on the right (forecast, useful links, emergency information), with 32px between columns and sections.

**Spacing** follows a 4px-based scale (4, 8, 12, 16, 24, 32, 48). Related items sit 8–12px apart, sections 32px apart, and there's more space above a heading than below it.

**Up to 899px** the layout becomes a single column, with a fixed bottom tab bar (Updates, Forecast, Info) that shows one view at a time. At this width the header is 56px tall and sections are 20px apart.
- **Up to 600px**, the timeline's Guernsey switch moves below the filter chips.
- **Up to 480px**, secondary header text is hidden, and the gust chip shows only "85 mph".
- **Up to 420px**, cards use 14px of padding.

Day headings stick to the top under the header as you scroll. Filter chips scroll sideways, fading out at the right edge rather than wrapping.

Every tap target is at least 44px tall on phones (38px buttons sit inside larger hit areas), and the page never scrolls sideways.

## Elevation & Depth

The system is a hybrid. In light mode, Paper cards sit on Sea Mist with a hairline border and a barely visible ambient shadow. In dark mode there are no shadows: depth comes from three graphite steps (background, surface, raised). The sticky header and the mobile tab bar are translucent with a background blur, so content stays sensed as it scrolls beneath them. The header's bottom hairline only appears once content scrolls under it.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 1px 2px rgba(15,20,25,.04), 0 1px 3px rgba(15,20,25,.06)`; none in dark mode): cards, panels, timeline events and post cards at rest.
- **Floating** (`box-shadow: 0 8px 24px rgba(15,20,25,.12)`; `0 8px 28px rgba(0,0,0,.35)` in dark mode): only elements that float above content, such as the "new updates" pill.

### Named Rules
**The Barely-There Rule.** Surfaces are separated by a hairline first and shadow second. If a shadow is noticeable at a glance, it's too strong.

## Shapes

The shapes are soft rounded rectangles in a few nested steps:
- 16px for cards and panels;
- 12px for rows and tiles inside them (warning rows, stat tiles, the "Show all posts" button, link previews);
- 10px for source rows and media;
- 6px for badges and 5px for reference chips;
- fully round for anything you tap to choose (filter chips, the gust chip, icon buttons, the "new updates" pill, the active-tab highlight, the Guernsey switch).

Avatars are circles. Borders are always 1px. Severity is never shown as a thick coloured edge.

## Components

### Buttons
- **Icon button:** a 38px circle in Paper with a hairline border and an 18px drawn icon. On hover it gets a stronger hairline and a Deeper Sea Mist fill, and it scales to 0.95 when pressed. Refresh spins while loading. The theme toggle cycles auto → light → dark, with a crossfade between themes.
- **"Show all posts":** a full-width 44px row with a hairline border, a 12px radius, Slate text and a count. The text turns ink on hover, and the chevron flips when the list is open.
- **"New updates" pill:** a floating Channel Blue pill with an up arrow and a count, which slides down into place.

### Chips
- **Filter chips:** 34px tall (38px on phones), fully round, Paper with a hairline border, label weight and a Slate count. When selected, they invert to a Harbour Ink fill with Sea Mist text.
- **Gust chip (header):** fully round and 32px tall, filled with the severity colour in light mode and tinted in dark mode.
- **Warning badge:** a 6px-radius block in capitals (RED, AMBER, YELLOW), solid in light mode and tinted in dark mode.
- **Source type badge:** a small Deeper Sea Mist block with Slate text (X, Bluesky, BBC, JEP, gov.je, Facebook, Web).

### Cards / Containers
- **Corner style:** 16px.
- **Background:** Paper, or Graphite Surface in dark mode.
- **Shadow strategy:** Ambient only (see Elevation & Depth).
- **Border:** a 1px hairline, which strengthens on hover.
- **Internal padding:** 16px (14px on small phones), and 24px for the "Right now" panel on desktop.

### Inputs / Fields
- **Guernsey switch:** a 34×20px rounded track, a Strong Hairline grey when off and Harbour Ink when on. The 16px knob slides 14px. It's a real checkbox with `role="switch"`, so it works with the keyboard and screen readers.

### Segmented control (Simple | Detailed)
A fully round Deeper Sea Mist track with two 34px text buttons (44px hit areas). The selected one is a Paper pill with the ambient shadow (Strong Hairline in dark mode). Always labelled in words, never icon-only.

### Now strip
One line of live readings in Slate-weight body text (two lines at most on phones, with that space held from the start). Each part is a quiet underlined text button that opens Detailed at its section. No cards, tiles or icons.

### Navigation
- **Header:** sticky, translucent Sea Mist with a blur. It holds the logo tile (a Channel Blue square with a wind glyph), the title, the live status, the gust chip and the icon buttons.
- **Mobile tab bar:** fixed to the bottom and translucent. Each tab has an icon over a label. The active tab is Channel Blue, with a soft 15% Channel Blue pill behind its icon. Switching tabs crossfades, and tapping the active tab scrolls back to the top.

### Event card (signature component)
The timeline's unit, one per storm event, grouped under sticky day headings.
- **Collapsed:** a meta row (severity dot and label, category icon and name, area, time range on the right), the title, and a summary of one or two sentences.
- **Severity:** Major events have a Warning Red dot, a red-tinted border and a heavier title. Notable events have an amber dot. Info events have no label and a slightly sunken background.
- **Expand:** the whole header is the button, and the chevron flips. The body grows smoothly (grid rows from 0fr to 1fr) and its contents fade in. It shows the details, with `[n]` turned into small Channel Blue reference chips, then a light list of sources (number, avatar or favicon, publisher, @handle, type badge, time, title).
- **Filter changes:** cards glide to their new places, and newly shown cards fade in.

### Warning row
A `<details>` element tinted in its warning colour, with a 12px radius and a 32% colour border. It shows the colour badge, the name and a one-line summary, with a chevron. It opens smoothly to show validity, impacts and the issue time.

## Do's and Don'ts

### Do:
- **Do** take every colour from the CSS custom properties on `:root`, and define both themes (the `prefers-color-scheme` block and the `[data-theme]` overrides).
- **Do** keep motion between 120 and 340ms, using `cubic-bezier(.16,1,.3,1)`:
  - press feedback about 120ms;
  - colour changes 150–200ms;
  - crossfades about 240ms;
  - glides and expands 260–340ms.
- **Do** signal a live refresh once, never in a loop:
  - the Live dot pings once per successful refresh;
  - a number that changed rolls up into place (420ms);
  - a warning that appeared or changed colour gets two soft rings in its own colour (1.3s each);
  - new events rise in.
- **Do** fade content in where it replaces a skeleton (opacity only, 260ms), so nothing moves.
- **Do** give phone taps a light haptic: selections, toggles, expanding, tabs and the theme switch. Refresh gets a firmer one. Android uses `navigator.vibrate` (10ms, or 18ms for refresh). iOS uses a hidden `<input type="checkbox" switch>` toggle. Only fire on coarse pointers, only inside the tap, and once per action.
- **Do** keep the social card (`og.png`, from `tools/og.html`) free of live data, because social sites cache it for days.
- **Do** give every animation a reduce-motion path (skip it, or make it instant), and keep content visible if a script fails.
- **Do** use drawn SVG icons with a 2px stroke and round caps, or the masked external-link arrow (`.ext`), for every icon.
- **Do** use tabular figures for times and measurements, and balanced wrapping for headings.
- **Do** keep tap targets at least 44px on phones, text contrast at least 4.5:1, and the page free of horizontal scrolling at 390px.

### Don't:
- **Don't** use red, amber or yellow for anything except Jersey Met warnings and gust or event severity. See the Only-Warnings-Shout Rule.
- **Don't** use tracked capitals for labels or headings. Capitals are only for the official warning badges.
- **Don't** mark severity with a thick coloured left or right edge. Use the dot and label, plus a tinted border for Major.
- **Don't** use Unicode arrows, triangles or emoji as icons.
- **Don't** add web fonts, heavy images or page-load choreography. The page has to stay quick on a weak storm-time connection.
- **Don't** add stat-tile grids, glass panels, gradient text or flashing or looping alerts. The tone is calm news, not a SaaS dashboard or a tabloid.
