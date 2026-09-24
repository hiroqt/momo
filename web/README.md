# Momo landing page

Momo's standalone landing page uses Next.js, React, TypeScript, Tailwind CSS, and Motion. Brand illustrations and fonts are copied from `mobile/assets`.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run lint` and `npm run build` before deployment.

The page describes the product defined in `ARD_PRD.md`. Set `NEXT_PUBLIC_GOOGLE_PLAY_URL` and `NEXT_PUBLIC_APP_STORE_URL` to Momo's verified store listings when they are live. Until then, the store buttons clearly show that the links are coming soon.

The Screen View gallery and hero preview use the five iPhone screenshots supplied for the Momo app, stored in `public/screens`.
The Important Part section plays a web-optimized version of the supplied `Momo.mp4` recording from `public/media/momo-demo.mp4`. The source recording stays outside this project.

The transparent full-body Momo illustration was created for this page using Momo's existing mascot artwork as reference. Taps anywhere on the page cycle through three synthesized cartoon monkey calls. Visitors can mute them with the sound toggle beside the hero preview.
