# AwaazPe Workspace

## Overview

AwaazPe — India's voice-based UPI payment app built with Expo (React Native) and an Express backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Mobile**: Expo SDK 54 with Expo Router (file-based routing)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Voice AI**: Sarvam AI (saarika:v2 for STT, bulbul:v1 for TTS, mayura:v1 for translation)

## Environment Variables

- `SARVAM_API_KEY` — Sarvam AI API key for voice features
- `DATABASE_URL` — PostgreSQL connection (if provisioned)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server with Sarvam AI routes
│   └── awaazpe/            # Expo React Native mobile app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## App Features

### AwaazPe (Expo)
- Onboarding: Language selection (8 Indian languages), Theme selection (dark/light)
- Home: Balance card, quick contacts, recent transactions, sonar nearby button
- Voice Pay: Mic button → Sarvam STT → local voice parse → payment confirmation
- History: Full transaction list with filters (type, category, search)
- Graphs: Monthly bar chart, weekly line chart, category breakdown (react-native-chart-kit)
- Profile: QR code display, theme toggle, language switcher, colorblind mode
- QR Screen: Generate & display personal QR, scan QR codes via camera
- Nearby: Radar animation + mock nearby users for P2P transfer
- Split: Multi-person payment splitting
- Receipt: Animated success screen with particle effects + sharing
- Request: Send payment requests to contacts

### API Server
- `POST /api/voice/stt` — Sarvam AI speech-to-text (saarika:v2)
- `POST /api/voice/parse` — Local voice command parsing (no external AI)
- `POST /api/voice/tts` — Sarvam AI text-to-speech (bulbul:v1)
- `POST /api/voice/translate` — Sarvam AI translation (mayura:v1)

## Design

- Colorblind-friendly palette: Indigo primary, Blue for success (not green), Orange for danger (not red)
- Dark/Light themes with deep navy/soft white backgrounds
- Colorblind mode toggle available in Profile
- Inter font throughout

## Supported Languages
English, Hindi, Bengali, Tamil, Telugu, Kannada, Marathi, Gujarati
