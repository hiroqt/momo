# AI Study Platform - Mobile Application

Cross-platform mobile application built with React Native, Expo, and TypeScript for interactive, grounded document-based studying.

---

## Features

- **Document Upload**: Direct-to-S3 presigned uploads with client-side format and size validation.
- **Interactive Study Interfaces**:
  - Flashcard deck with flip animation and mastery tracking
  - Interactive quiz runner with immediate feedback and explanation
  - Source attribution inspector showing exact source pages/slides
- **Offline Mode**: Local caching of study sets and study progress via Expo SQLite.
- **Offline Synchronization**: Idempotent synchronization engine that flushes queued study events to the backend when network connectivity is restored.
- **Responsive Navigation**: File-based routing with Expo Router and custom fluid transitions.

---

## Directory Structure

```
mobile/
|-- app/                      # Expo Router navigation routes
|   |-- _layout.tsx           # Root navigation layout
|   |-- (tabs)/               # Bottom tab screens (Home/Dashboard, Library, Profile)
|   |-- documents/upload.tsx  # Document picker and upload progress screen
|   |-- generation/[jobId].tsx # Real-time generation progress and status polling
|   `-- study/[studySetId].tsx # Study set view (Flashcards and Quiz runner)
|-- components/
|   |-- common/               # Shared UI elements (headers, buttons, modals)
|   |-- mascot/               # Mascot animations and interactive cards
|   `-- study/                # Flashcard deck, quiz runner, source attribution
|-- lib/
|   |-- api/                  # Typed REST API client (documents, generations, study sets)
|   |-- auth/                 # Authentication state and tokens
|   |-- storage/              # Expo SQLite local database schema and queries
|   `-- sync/                 # Background synchronization engine for offline sessions
|-- types/                    # Shared TypeScript interface definitions
|-- app.json                  # Expo project configuration
`-- package.json              # Dependencies and scripts
```

---

## Setup and Development

### Prerequisites

- Node.js (version 18 or higher)
- npm (version 9 or higher)
- Expo Go app on a mobile device or configured iOS Simulator / Android Emulator

### Installation

```bash
cd mobile
npm install
```

### Environment Configuration

Create a `.env` file in the `mobile/` directory:

```ini
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Note: If running on a physical mobile device using Expo Go, change `localhost` in `EXPO_PUBLIC_API_URL` to your development machine's local IP address (e.g. `http://192.168.1.100:8000`).

### Running the App

```bash
# Start the Expo development server
npm start

# Run on iOS Simulator (macOS only)
npm run ios

# Run on Android Emulator
npm run android

# Run on Web
npm run web
```

### Type Checking

```bash
npm run lint
```
