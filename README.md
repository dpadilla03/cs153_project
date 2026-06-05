# LifeCal - CS153 Final Project

An AI-powered scheduling app with two modes: **Work Mode** parses a syllabus PDF and populates your calendar with deadlines; **Fun Mode** chats with you to find activities and places nearby.

You can find the live version at:
[https://cs153-project.pages.dev/](https://cs153-project.pages.dev/)
---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, deployed on Cloudflare Pages |
| Backend | Python FastAPI, deployed on DigitalOcean droplet via pm2 |
| HTTPS tunnel | Cloudflare Tunnel (`api.lifecal.cc` → droplet port 8000) |
| LLM | Anthropic Claude (`claude-sonnet-4-5` for chat, `claude-haiku-4-5` for PDF parsing) |
| PDF parsing | pdfplumber |
| Places search | Foursquare Places API (`places-api.foursquare.com`) |
| Calendar | FullCalendar.js (frontend only) |

---

## Project Structure

```
LifeCal/
├── src/
│   ├── App.jsx               # Root component — all state lives here
│   ├── App.css               # Global styles (dark theme, CSS variables)
│   ├── utils/
│   │   └── api.js            # Exports API_BASE from VITE_API_URL env var
│   └── components/
│       ├── CalendarView.jsx  # FullCalendar wrapper
│       └── ChatBox.jsx       # Chat UI for both modes
├── backend/
│   ├── main.py               # FastAPI app, CORS config, router registration
│   ├── .env                  # ANTHROPIC_API_KEY, FOURSQUARE_API_KEY (gitignored)
│   └── routes/
│       ├── chat.py           # POST /api/chat/ — Claude agent, mode-aware prompts
│       ├── syllabus.py       # POST /api/syllabus/parse — PDF → Claude → calendar events
│       └── places.py         # POST /api/places/search — Foursquare category search
├── .env                      # VITE_API_URL=https://api.lifecal.cc (gitignored)
└── .env.example              # Safe template, committed to git
```

---

## Modes

### Work Mode

Upload a syllabus PDF. The backend extracts the text with pdfplumber, sends it to Claude Haiku with a structured prompt, and returns a JSON list of assignments with titles, due dates, types, and estimated hours. These are added to FullCalendar as blue (`#6c8aff`) events and the calendar auto-navigates to the first deadline.

### Fun Mode

Chat with Claude to find activities near you. The flow:

1. User sends a message (e.g. "I want breakfast somewhere nice Saturday")
2. Claude responds conversationally, then appends a controlled keyword on the last line: `SEARCH: breakfast`
3. ChatBox strips the tag, displays the clean reply, and calls `/api/places/search`
4. Foursquare returns places filtered by category + location + price
5. Results render as place cards with an "Add to Calendar" button

---

## Place Search Logic

The Foursquare endpoint used (`places-api.foursquare.com`) does not support free-text search — it filters by **category IDs** and **location**. The backend maps Claude's SEARCH keyword to a Foursquare category ID:

| Keyword | Category ID | Description |
|---|---|---|
| `restaurant` | 13000 | Food (all) |
| `breakfast` | 13064 | Breakfast & Brunch |
| `coffee` | 13032 | Café & Coffee |
| `bar` | 13003 | Bars & Nightlife |
| `entertainment` | 10000 | Arts & Entertainment |
| `outdoor` | 16000 | Outdoors & Recreation |
| `shopping` | 17000 | Shops & Services |

Claude is instructed to output one of these exact keywords in the SEARCH tag. If the keyword doesn't match (edge case), the user's **activity type preference** is used as a fallback category. The user's **budget preference** maps to Foursquare's `price` filter (1–4).

---

## User Preferences (Fun Mode)

| Preference | Effect |
|---|---|
| Location | Passed as `near` to Foursquare; injected into Claude's system prompt |
| Budget (`$`–`$$$$`) | Maps to Foursquare `price` 1–4; injected into Claude's system prompt |
| Activity type | Injected into Claude's system prompt as a nudge; used as fallback Foursquare category if the SEARCH keyword doesn't match |

---

## API Routes

### `POST /api/chat/`
```
Body:  { messages: [{role, content}], mode: "work"|"fun", preferences: {location, budget, activity_type} }
Response: { reply: string }
```
Claude is given a mode-aware system prompt. In Fun Mode, preferences are injected and Claude is instructed to end with a `SEARCH: <keyword>` tag when recommending places.

### `POST /api/syllabus/parse`
```
Body:  multipart/form-data — PDF file
Response: { course_name: string, assignments: [{title, due_date, type, estimated_hours, description}] }
```
pdfplumber extracts text, Claude Haiku returns structured JSON.

### `POST /api/places/search`
```
Body:  { query, location, budget, activity_type, limit }
Response: { places: [{name, category, address, distance, url}], query, location }
```
Infers a Foursquare category ID from the query (falling back to activity_type), applies price filtering, queries Foursquare.

---

## State (App.jsx)

```js
mode              // 'work' | 'fun'
events            // FullCalendar events array
calendarDate      // auto-navigate calendar on event add
workMessages      // work chat history (separate from fun)
funMessages       // fun chat history
preferences       // { location, budget, activity_type }
uploadStatus      // 'idle' | 'loading' | 'done' | 'error'
```

---

## CSS Variables

```css
--bg: #0f0f11
--surface: #1a1a1f
--surface-2: #24242b
--border: #2e2e38
--text: #e8e8f0
--text-muted: #7a7a8c
--accent-work: #6c8aff        /* blue — Work mode */
--accent-fun: #ff7a6c         /* coral — Fun mode */
--accent-work-dim: rgba(108,138,255,0.12)
--accent-fun-dim: rgba(255,122,108,0.12)
```

---

## Local Development

**Frontend**
```bash
cd LifeCal
cp .env.example .env          # set VITE_API_URL=http://localhost:8000
npm install
npm run dev                   # runs on localhost:5173
```

**Backend**
```bash
cd LifeCal/backend
python -m venv venv && source venv/bin/activate

# Generate requirements.txt if it doesn't exist yet
pip freeze > requirements.txt

pip install -r requirements.txt
cp .env.example .env          # set ANTHROPIC_API_KEY and FOURSQUARE_API_KEY
uvicorn main:app --reload     # runs on localhost:8000
```

> **Note:** If you add new Python dependencies, regenerate `requirements.txt` before pushing:
> ```bash
> cd LifeCal/backend
> source venv/bin/activate
> pip freeze > requirements.txt
> ```

---

## Deployment

### Live URLs
- **Frontend:** https://cs153-project.pages.dev
- **Backend API:** https://api.lifecal.cc

### Deploy commands

| Step | Command |
|---|---|
| Deploy frontend | Push to `main` — Cloudflare Pages auto-deploys |
| Deploy backend | SSH into droplet → `git pull` → `pm2 restart lifecal-backend` |
| Frontend env vars | Set in Cloudflare Pages dashboard |
| Backend env vars | Edit `backend/.env` on the droplet |

### SSH into the droplet
```bash
ssh root@167.99.172.146
cd ~/cs153_project
git pull
pm2 restart lifecal-backend
```
