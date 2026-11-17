---
# gstack: design-md-format=spec
name: MasterGrow â€” Midnight Fieldwork
description: A dark botanical fieldwork console with cannabis-leaf identity, forest surfaces and technical typography.
colors:
  primary: "#bddf88"
  on-primary: "#172014"
  canvas: "#0d1510"
  surface: "#17241c"
  surface-raised: "#22372a"
  text: "#edf2e9"
  text-muted: "#a6b6a9"
  border: "#354b3b"
  accent: "#bddf88"
  success: "#bddf88"
  warning: "#f6c878"
  error: "#ffc1b0"
typography:
  display:
    fontFamily: Chakra Petch
    fontWeight: 500
    fontSize: clamp(36px, 4.2vw, 64px)
    letterSpacing: -0.03em
  body:
    fontFamily: DM Sans
    fontSize: 14px
    lineHeight: 1.7
  label:
    fontFamily: Chakra Petch
    fontSize: 11px
    letterSpacing: 0.12em
  mono:
    fontFamily: monospace
    fontFeature: tnum
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#d3edab"
  input:
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# MasterGrow

## Direction and rationale

Memorable idea: real-world experience becomes shared intelligence. The dashboard's layered source, lesson and conversation cards are actionable destinations, not simulated telemetry. Technical display typography and precise geometry give the product its character; quiet surfaces keep evidence and training readable.

This replaces Botanical Atelier at the user's request for a darker, innovative design. The prior specification is preserved in DESIGN.md.legacy.bak. The user authorized recommended defaults through the planning skills. This direction, font pairing and implementation were selected under that authorization, not represented as subsequent explicit visual feedback.

## Typography

Chakra Petch is verified at https://fonts.google.com/specimen/Chakra+Petch and bundled through Fontsource. DM Sans remains the readable interface face. Use the display face for titles, workflow identifiers and counts; keep long instructions and conversations in the body face. Do not use all-caps for paragraphs.

## Layout and depth

Persistent desktop sidebar; accessible mobile drawer. Learning uses a lesson list and reading panel. Capture makes the camera preview dominant; practice controls stack below on mobile. Chat puts the conversation first with a separate proactive workspace briefing. Subtle borders separate surfaces. Only the dashboard's workflow illustration uses elevated, tilted cards.

## Components and states

Every status has text as well as color. Empty libraries show true zero counts. Configured means a server key exists, not funded or verified AI. Sources, generated drafts, approved procedures and published lessons remain distinct. Lesson completion means acknowledgement, not certified competency. Workspace pulse is based on real records, not invented AI activity.

## Motion and accessibility

Short hover transitions; no continuous decorative motion. Honor reduced motion. Visible keyboard focus, native dialogs, labeled inputs, sufficient text contrast and readable mobile layouts are required. Camera and microphone need explicit user activation. Camera tracks stop on navigation and tab hiding. Do not conceal uncertain AI output behind success styling.

## Design consultation record

The gstack design and browse binaries and Aside browser were unavailable. Used the skill's HTML-preview fallback with local Playwright inspection. No competitor screenshots or independent outside-voice review are claimed. Font verification used the official Google Fonts page. A self-contained specimen with dark/light comparison and product mockups is saved under `C:/Users/jayny/.gstack/projects/jaynyasg-Zapp/designs/midnight-fieldwork/preview.html`. Product screenshots are in docs/screenshots.

## Canopy refinement — 2026-11-16

The user likes the existing design and requested a stronger cannabis identity. Retain the typography, composition and responsive layout. Derive dark surfaces from forest greens, soften the primary accent, and use the bundled Lucide Cannabis icon as the brand mark. This is a visual identity change, not an expansion into automated cultivation coaching.

Navigation separates Everyday records, Lessons & practice, and Workspace library. My collection owns dated photos, user-entered measurements and issue logs. Learning studio owns lesson completion. Collection photos are stored without AI analysis and do not produce lessons automatically.

The design consultation used the user's standing recommended-default authorization: update the existing specification, retain verified local Chakra Petch/DM Sans files and licenses, skip outside voices, and use an HTML specimen because gstack design/browser binaries and Aside were unavailable. No competitor visual research is claimed. Preview: C:/Users/jayny/.gstack/projects/jaynyasg-Zapp/designs/canopy-fieldwork/preview.html. Token source is the implemented CSS and that preview; gstack format validation passed with a Windows-compatible empty Bun config.
