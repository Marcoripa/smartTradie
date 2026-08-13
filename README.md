# SmartTradie: Hands-Free Offline Voice Note App

An offline-first, hands-free voice-guided note-taking application designed for drivers and field workers traveling through regional Australia (where 4G/5G cell coverage is frequently unavailable). 

The mobile app guides drivers through an automated voice questionnaire, records spoken responses locally in low-bitrate AAC format, queues them in an offline SQLite database, and automatically uploads/structures them via a FastAPI backend and Google Cloud Platform (GCP) when cellular connectivity is restored.

---

## 🚀 Key Features

### 1. Hands-Free Conversational State Machine (Offline)
- **Australian Road Rules Safety:** 100% voice-guided with zero screen interaction required while driving.
- **Audio Focus & Volume Ducking:** Requests native audio focus so background car radio/music volume ducks when speaking or recording audio, and resumes playback when finished.
- **Voice Activity Detection (VAD):** Detects driver speech start and trailing silence (2.2s threshold) to automatically advance through prompt steps without pressing buttons.
- **3-Step Guided Questionnaire:**
  1. *Context:* "What project or client is this note for?" -> `prompt_1_client.m4a`
  2. *Main Note:* "Go ahead with your main note." -> `prompt_2_content.m4a`
  3. *Action Items:* "Any follow-up action items?" -> `prompt_3_actions.m4a`

### 2. Offline-First SQLite Storage & Auto-Sync
- **On-Device Storage:** Captures mono AAC/M4A audio (~500 KB/min) and writes records with status `PENDING_UPLOAD` to local SQLite.
- **Network Monitoring:** Auto-triggers sync upon 4G/5G network reconnection using `@react-native-community/netinfo`.
- **Offline Simulation Mode:** Interactive switch in mobile UI to test regional offline queuing and automatic background uploads.

### 3. FastAPI Backend & GCP Cloud Run Architecture
- **Resumable GCS Signed Uploads:** Generates Google Cloud Storage signed upload URLs (`x-goog-resumable`) to handle spotty regional internet reconnects without losing upload progress.
- **AI Processing Engine:** 
  - **Speech-to-Text:** Google Cloud STT v2 / OpenAI Whisper API integration.
  - **Gemini 2.0 Flash:** Cleans noisy driving transcripts (removes "um", "ah", vehicle noise) and converts them into structured JSON/Markdown notes with action items, categories, and urgency levels.
- **Synchronized DB:** GCP Firestore / Cloud SQL persistent storage with local fallback.

---

## 🛠️ Tech Stack

- **Mobile Frontend:** React Native (Expo), `expo-speech` (On-device TTS), `expo-av` (Audio Focus Ducking & VAD metering), `expo-sqlite` (Offline queue), `@react-native-community/netinfo` (Auto-sync listener).
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, Google GenAI SDK (`google-genai` / Gemini 2.0 Flash), `google-cloud-storage`, `google-cloud-speech`, `google-cloud-firestore`.
- **Infrastructure:** Google Cloud Run (Serverless), Docker, Docker Compose.

---

## 📁 Repository Structure

```
smartTradie/
├── mobile/                        # React Native Expo Frontend
│   ├── App.tsx                    # Main App UI & Hands-free controls
│   ├── src/
│   │   ├── components/            # AudioVisualizer, DriveModeHeader, QueueViewer
│   │   ├── hooks/                 # useVoiceStateMachine (State Machine)
│   │   ├── services/              # audio.ts (Audio Focus), tts.ts, sqlite.ts, vad.ts, sync.ts
│   │   └── types/                 # TypeScript interfaces
│   ├── package.json
│   └── app.json
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point
│   │   ├── config.py              # Environment & GCP settings
│   │   ├── routes/                # upload.py, notes.py, health.py
│   │   ├── services/              # gcs_service.py, stt_service.py, ai_service.py, db_service.py
│   │   └── schemas/               # Pydantic data models
│   ├── Dockerfile                 # GCP Cloud Run container definition
│   ├── docker-compose.yml
│   └── requirements.txt
└── README.md
```

---

## 🏁 Quick Start Guide

### 1. Running the FastAPI Backend

#### Option A: Local Python Virtual Environment
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start local server (Runs on http://localhost:8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Option B: Docker Compose
```bash
cd backend
docker-compose up --build
```

Interactive API documentation will be available at [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs).

---

### 2. Running the Mobile App (Expo)

```bash
cd mobile
npm install

# Start Expo dev server
npx expo start
```

Press `w` to open in browser, `a` for Android Emulator, or `i` for iOS Simulator.

---

## ☁️ Google Cloud Run Deployment

To deploy the backend to Google Cloud Run:

```bash
cd backend

# Build container using Google Cloud Build
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/smart-tradie-backend

# Deploy to Cloud Run (Auto-scaling to zero)
gcloud run deploy smart-tradie-backend \
  --image gcr.io/YOUR_GCP_PROJECT_ID/smart-tradie-backend \
  --platform managed \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_KEY",GCS_BUCKET_NAME="YOUR_BUCKET"
```

---

## 🧪 Testing the Offline Hands-Free Workflow

1. Open the mobile app.
2. Toggle **"Simulate Offline"** to simulate driving through remote regional areas without 4G/5G signal.
3. Tap **"START HANDS-FREE SESSION"**.
4. Listen to prompt 1 ("What project or client is this note for?"), speak your answer, and pause. VAD will auto-advance to step 2 and step 3 hands-free.
5. Notice the note is saved locally into SQLite with status `PENDING_UPLOAD`.
6. Toggle **"Simulate Offline"** off.
7. The app detects 4G/5G network restoration, uploads the audio files, processes them with **Gemini 2.0 Flash**, and updates the status to `UPLOADED` with structured action items!
