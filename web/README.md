# Momo landing page

Momo's standalone landing page uses Next.js, React, TypeScript, Tailwind CSS, and Motion. Brand illustrations and fonts are copied from `mobile/assets`.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run lint` and `npm run build` before deployment.

The page describes the product defined in `ARD_PRD.md`. Set `NEXT_PUBLIC_GOOGLE_PLAY_URL` and `NEXT_PUBLIC_APP_STORE_URL` to Momo's verified store listings when they are live. Until then, the store buttons clearly show that the links are coming soon.

The closing CTA (`StudyAnywhere`) uses a lavender study scene, Momo's existing mascot, paper notes, and a keyboard-accessible sample flashcard. Its copy distinguishes saved offline reviewers from creating new study material online. The `#get-momo` anchor leads to this section; the preview link leads to Screen View. Styles are scoped in `StudyAnywhere.module.css`, including mobile and reduced-motion behavior.

The Screen View gallery uses the five iPhone screenshots supplied for the Momo app, stored in `public/screens`. The hero pairs a stationary Momo illustration with a two-line study headline and Google Play / App Store coming-soon buttons. Clicking Momo still opens the interactive chat preview.
The Important Part section plays a web-optimized version of the supplied `Momo.mp4` recording from `public/media/momo-demo.mp4`. The source recording stays outside this project.

The transparent full-body Momo illustration was created for this page using Momo's existing mascot artwork as reference. Taps anywhere on the page rotate through three monkey sounds (`monkey-1.ogg`, `monkey-2.ogg`, `monkey-3.ogg`) from the [CC0 Monkey Sounds pack by AntumDeluge](https://opengameart.org/content/monkey-sounds). Rapid taps crossfade the previous call, and the header sound toggle stops playback immediately. The 42 playful click messages shuffle without repeats within a round and retain the original plain floating-text design, gray lettering, white text shadow, fixed tilt, and 1.1-second lifetime. Preserve this design unless a redesign is explicitly requested. Dragging and scrolling do not trigger reactions; reduced motion keeps the text stationary. The unmodified source files and their CC0 license are stored in `web/assets/sounds` and served from `web/public/sounds`.

`SmoothScroll` uses Lenis for eased wheel and anchor scrolling, preserves native touch scrolling, and excludes the chat message scroller with `data-native-scroll`. Reduced-motion preferences disable smooth scrolling and the decorative cursor, including when the preference changes while the page is open.

`BananaCursor` uses the Hugeicons banana icon through the shared `Icon` component. Its frame-rate-independent follow animation stops when settled or hidden. The small pointer dot stays at the real hit target; the banana snaps to it on click. Text fields, disabled controls, touch input, and keyboard navigation retain native cursor behavior.

UI verification: check the desktop and narrow-screen hero, the hero store availability labels and header download link, mascot chat open/close, scrolling within chat, keyboard focus, banana hover/click feedback, pointer exit/re-entry, and reduced-motion fallback. `npm run lint` is the project's TypeScript check; `npm run build` also validates the production bundle.

The app showcase now has five selectable screens with previous and next controls and a large central phone. Desktop previews are clickable; mobile keeps one readable phone and a two-column selector with no horizontal scrolling. Momo stays stationary and has a “Psst… tap me to chat” invitation.

The hero, product section, and closing CTA use the same `StoreButtons` component. When store URLs are missing, all three locations show matching “Coming soon” badges; configured listings turn those badges into links. On mobile, the closing CTA places its paper cards above Momo so his face and torso remain visible.

The landing-page chat is a product preview. `lib/momo-chat` separates approved product facts, response composition, a replaceable decision provider, and rate limits. Nemotron through OpenRouter selects validated fact IDs and a tone using the latest question and conversation history. Replies use approved product copy; model-authored product claims are never displayed. A local fallback handles common questions and short follow-ups if the provider is unavailable. It is less flexible for unusual phrasing.

Replies vary their wording and check recent responses. The client also suppresses duplicates across its current conversation and prevents double sends. Unrelated questions get a playful sarcastic redirect; unclear product claims get a clarification. Pricing and release dates remain unconfirmed. This preview cannot upload notes or generate study sets.

Run `npm test` for chat routing, history validation, provider failures, approved output, duplicate prevention, origin checks, and rate limit resets. Live provider calls are mocked. Rate limiting is local to this process; a multi-instance deployment needs a shared limiter and a trusted proxy that overwrites forwarded IP headers.

All website UI icons must use Hugeicons through `app/components/Icon.tsx` (`@hugeicons/react` and `@hugeicons/core-free-icons`). Add named icons to that component as needed; do not add other icon libraries, hand-drawn SVG icons, or Unicode icon substitutes. Keep accessible names on icon-only controls. Mascot artwork, app screenshots, and Lottie illustrations remain brand content.
