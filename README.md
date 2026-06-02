# feedback-popover

A from-scratch, zero-dependency **morphing feedback popover** in vanilla HTML / CSS / JS. A centered "Feedback" button morphs open into a small form, and submitting morphs it into a celebratory complete state with a full-screen confetti shower. Interaction inspired by [Emil Kowalski](https://emilkowal.ski/)'s feedback component.

## Run it

No build, no dependencies:

```
open index.html
```

(or double-click `index.html`)

## What's in it

- **Morph interaction** — a centered button morphs into the form and into the success state (size + content crossfade + blur, following Emil's morph logic). `transform-origin: center`.
- **Simple form** — Rate your experience (emoji) + Share your thoughts + Send.
- **Hover face-swap** — hovering a rating crossfades its emoji: 🤢→🤮, 🙂→😊, 😄→😍 (gated behind `@media (hover: hover)`).
- **Complete celebration** — a small 🥳, then a full-screen confetti rain (body-level particles that fall full-width, sway, rotate, and fade out), then auto-dismiss.
- **Haptics** — web-haptics-style cues via the Vibration API (open / select / submit / error / close), no-op on desktop.
- **Respects `prefers-reduced-motion`.**

```
index.html      demo page (centered stage) + includes
feedback.css    morph + form + success styles
feedback.js     state machine, validation, haptics, confetti — exposes window.toast-free widget
tests.html      dependency-free assertions for validate() + vibratePattern()
```

## Credit

Morph/feedback interaction modeled on [Emil Kowalski](https://emilkowal.ski/)'s work. Educational re-implementation.
