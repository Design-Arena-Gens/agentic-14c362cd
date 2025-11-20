# PrismForge Studio

PrismForge Studio is an AI-first image editing environment for creatives and web teams. Upload brand imagery, iterate with prompt-driven edits powered by Hugging Face InstructPix2Pix, carve out backgrounds with on-device matting, and instantly capture color palettes for design systems.

## Features

- Prompt-based image remixes using Hugging Face Inference API (InstructPix2Pix)
- Smart background removal powered by Hugging Face BRIA RMBG
- Palette extraction with quick copy-to-clipboard for design tokens
- Privacy-aware: assets are processed client-side, API keys stay in the browser

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 to explore the studio.

### Prompt Remix requirements

Generate a Hugging Face token with **Inference** permission and paste it into the workflow settings. Tokens are stored locally only if you opt in.

### Build

```bash
npm run build
```

### Deploy

To deploy to Vercel:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-14c362cd
```

After deploy, verify:

```bash
curl https://agentic-14c362cd.vercel.app
```
