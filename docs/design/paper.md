# Paper: the Merge design system

Paper is the visual language of the Merge mobile app: warm paper grounds, plum ink for actions,
and one coral accent. Photos and what people wrote carry the colour; the interface stays quiet.
This document is the reference for anyone changing a screen. The tokens live in
`apps/mobile/src/theme/tokens.ts`.

## Principles

1. **People first, chrome second.** A member's name, photos and own words are the largest and
   warmest things on any screen.
2. **Two voices.** Fraunces (serif) is used for people: names, screen titles, and anything a
   member wrote. Manrope (sans) is used for the interface: labels, buttons, captions.
3. **Tech in the words, not the walls.** "Pull request" and "Merged" are the product's
   vocabulary, and the tab icons are the git pull-request and merge marks. Nothing else imitates a
   developer tool, so the app reads as a dating app to someone who has never used git.
4. **Native by default.** Platform push transitions, page sheets, a tab bar that does not animate
   between peers, each platform's back icon, continuous corners, hairline rules.

## Tokens

| Token                                      | Value                             | Used for                                                                   |
| ------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| `colors.background`                        | `#FAF8F5`                         | Screen ground                                                              |
| `colors.surface`                           | `#FFFFFF`                         | Cards, bubbles, inputs, tab bar                                            |
| `colors.sand`                              | `#F3EBDD`                         | Photo grounds, chips, avatars, pressed rows                                |
| `colors.ink`                               | `#211A1F`                         | Text                                                                       |
| `colors.muted`                             | `#6E636B`                         | Supporting text (AA on background, surface, sand, plumSoft)                |
| `colors.plum` / `plumPressed` / `plumSoft` | `#5A2E4F` / `#422239` / `#F0E9EE` | Actions, outgoing bubbles, active tab                                      |
| `colors.coral` / `coralSoft`               | `#E65F55` / `#FBE9E6`             | The like heart and a quote rule. Graphic only, never text or a text ground |
| `colors.border` / `fieldBorder`            | `#E3DDDF` / `#95858E`             | Hairlines / input edges (3:1)                                              |
| `radii`                                    | 12, 16, 24, 28, pill              | Controls 16, cards and photos 24                                           |
| `spacing`                                  | 4, 8, 16, 24, 32, 48              | Everything; do not invent values                                           |
| `hairline`                                 | one device pixel                  | Card edges and dividers                                                    |
| `cardShadow`                               | one soft elevation                | Floating round controls only                                               |

### Type

| Variant               | Face              | Size / line      | Used for                        |
| --------------------- | ----------------- | ---------------- | ------------------------------- |
| `hero`                | Fraunces 500      | 40 / 46          | Welcome headline                |
| `largeTitle`          | Fraunces 500      | 34 / 40          | Tab screen titles               |
| `display`             | Fraunces 500      | 32 / 38          | A member's name, step questions |
| `title`               | Fraunces 500      | 24 / 30          | Section and empty-state titles  |
| `quote`               | Fraunces 400      | 20 / 28          | Prompt answers                  |
| `headline`            | Manrope 600       | 17 / 23          | Row titles, values              |
| `body` / `button`     | Manrope 400 / 600 | 16 / 24, 22      | Text, buttons                   |
| `caption` / `eyebrow` | Manrope 400 / 600 | 13 / 19, 12 / 17 | Supporting text, small labels   |

## Components

| Component        | File                                      | Notes                                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AppButton`      | `components/app-button.tsx`               | primary (plum), secondary (outlined), quiet, danger. 54pt tall. Pressed darkens in place; disabled is plumSoft with muted text |
| `PressableScale` | `components/pressable-scale.tsx`          | Round controls: like, pass, send. Scales to 0.94 on press-in                                                                   |
| `IconButton`     | `components/icon-button.tsx`              | 44pt (48dp on Android), round pressed ground                                                                                   |
| `TextField`      | `components/text-field.tsx`               | 56pt, 3:1 edge, 2px plum edge on focus                                                                                         |
| `Reveal`         | `components/reveal.tsx`                   | One-time staggered entrance for rarely seen screens                                                                            |
| `BackIcon`       | `components/back-icon.ts`                 | Chevron on iOS, arrow on Android                                                                                               |
| Tab bar          | `features/discovery/discovery-screen.tsx` | Discover, Requests (pull-request icon), Merged (merge icon). Announced as a tab list                                           |

## Motion

| Element             | Trigger              | Motion                   | Duration       | Notes                    |
| ------------------- | -------------------- | ------------------------ | -------------- | ------------------------ |
| Buttons             | Press in             | Scale 0.96               | 130ms          | Native-driven            |
| Like, pass, send    | Press in             | Scale 0.94               | 120ms ease-out | UI-thread transition     |
| Next profile        | After a pass or like | Fade in                  | 150ms          | Frequent, so brief       |
| Welcome blocks      | First mount          | Fade up 12pt, 60ms apart | 420ms          | Rare, so allowed more    |
| Onboarding progress | Step change          | Width                    | 240ms ease-out | Out of flow, childless   |
| Tabs                | Tap                  | None                     | —              | Peers do not slide       |
| Screens             | Push                 | Platform default         | —              | Fade with reduced motion |

Haptics: a light impact when a pull request is sent, a success signal on a merge, a selection tick
on option pickers and reactions. Never on scroll or entrance. Reduced motion removes movement and
keeps colour changes.

## Voice

- Say what happened, then what to do: "Couldn’t save your prompts. Try again."
- No "please", no "successfully", no exclamation marks on system copy.
- Sentence case. Buttons start with a verb: "Send pull request", "Merge", "Decline".
- Placeholders are real examples ("Ada", "What caught your eye?"), never instructions ending in an
  ellipsis. An ellipsis means something is in progress.
- Explain the vocabulary once, plainly: "Like a line someone wrote and send a pull request. If
  they like you back, you’re merged."

## Content limits and behaviour

| Field                | Limit | Behaviour                                                              |
| -------------------- | ----- | ---------------------------------------------------------------------- |
| Display name         | 40    | Wraps on a profile; one line with ellipsis in rows and the chat header |
| Location label       | 164   | Wraps on a profile; two lines in a request card                        |
| Prompt answer        | 280   | Full on a profile; three lines in a request card                       |
| Pull request comment | 280   | Shown in full                                                          |
| Message              | 2,000 | Wraps; long unbroken strings break anywhere                            |

## Accessibility (WCAG 2.1 AA)

- Text contrast is pinned by `theme/tokens.test.ts`: muted text is at least 4.5:1 on background,
  surface, sand and plumSoft; white on plum is 9:1.
- Coral is 3.4:1 on white, so it is used for graphics only.
- Touch targets are at least 44pt (48dp on Android); round floating controls are 52–56pt.
- The tab bar is a tab list with selected state; decorative icons are hidden from screen readers.
- Not verified here: VoiceOver and TalkBack passes, and Dynamic Type at the largest sizes. Both
  need a device.

## Checking a screen

`/preview` (development builds only) renders the real Welcome, Discover, Requests, Merged and
chat screens over stand-in data. Add `?data=worst` for the longest values the API accepts and
`?empty=1` for empty states.

```sh
pnpm --dir apps/mobile exec expo start --web
# then open http://localhost:8081/preview?screen=discover&data=worst
```

The browser shows layout only. Haptics, native transitions, sheets and the keyboard need a phone.
