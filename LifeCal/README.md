# LifeCal

An AI-powered scheduling app with two modes: **Work Mode** parses a syllabus PDF and populates your calendar with deadlines; **Fun Mode** chats with you to find activities and places nearby.

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
│       ├── chat.py           # POST /api/chat/ — Claude agent, mode-aware prompts + calendar tools
│       ├── syllabus.py       # POST /api/syllabus/parse — PDF → Claude → calendar events
│       ├── places.py         # POST /api/places/search — Foursquare category search
│       └── calendar.py       # POST /api/calendar/export — events → .ics file download
├── .env                      # VITE_API_URL=https://api.lifecal.cc (gitignored)
└── .env.example              # Safe template, committed to git
```

---

## Modes

### Work Mode

Upload a syllabus PDF. The backend extracts the text with pdfplumber, sends it to Claude Haiku with a structured prompt, and returns a JSON list of assignments with titles, due dates, types, and estimated hours. These populate FullCalendar as blue (`#6c8aff`) events and the calendar auto-navigates to the first deadline.

Each syllabus event stores the full assignment metadata on the event object:

| Field | Source | Used for |
|---|---|---|
| `title` | assignment title | Calendar label, ICS SUMMARY |
| `date` | due date (YYYY-MM-DD) | Calendar position |
| `courseName` | parsed course name | ICS DESCRIPTION |
| `assignmentType` | assignment / exam / reading / project | ICS CATEGORIES |
| `estimatedHours` | Claude estimate | ICS DESCRIPTION |
| `assignmentDescription` | brief description from syllabus | ICS DESCRIPTION |

After the syllabus is loaded, the user can continue chatting to modify the calendar — Claude has access to calendar tools (see Work Mode Chat below).

### Fun Mode

Chat with Claude to find activities near you. The flow:

1. User sends a message (e.g. "I want breakfast somewhere nice Saturday")
2. Claude responds conversationally, then appends a controlled keyword: `SEARCH: breakfast`
3. ChatBox strips the tag, displays the clean reply, and calls `/api/places/search`
4. Foursquare returns places filtered by category + location + price
5. Results render as place cards, each with a date picker, optional time input, and **Add to Calendar** button

Clicking **Add** creates a FullCalendar event in coral (`#ff7a6c`) and navigates the calendar to that date. If a time is set, it creates a timed event; otherwise it's all-day.

---

## Work Mode Chat — Calendar Editing

After a syllabus is uploaded, the user can ask the work mode assistant to modify calendar events via natural language. Claude is given the full list of current events (with IDs) in its system prompt and has access to three tools:

| Tool | What it does |
|---|---|
| `add_event(title, date)` | Adds a new blue event to the calendar |
| `remove_event(id)` | Removes an event by its ID |
| `reschedule_event(id, new_date)` | Moves an event to a new date |

Example prompts: *"Move my midterm to the 20th"*, *"Remove the week 3 reading"*, *"Add a study session on Friday"*.

Claude always includes a plain-text explanation alongside any tool call so the user knows what changed.

---

## Place Search Logic

The Foursquare endpoint used (`places-api.foursquare.com`) does not support free-text search — it filters by **category IDs**, **location**, and **price**. The backend maps Claude's SEARCH keyword to a Foursquare category ID:

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

| Preference | Effect on Claude | Effect on Foursquare |
|---|---|---|
| Location | Injected into system prompt | `near` parameter |
| Budget (`$`–`$$$$`) | Injected into system prompt | `price` 1–4 |
| Activity type | Injected into system prompt as soft nudge | Fallback `categories` filter if SEARCH keyword doesn't match |

---

## ICS Export

The **↓ Export .ics** button appears in the sidebar whenever there are calendar events. It POSTs the full events array to `/api/calendar/export` and triggers a file download.

Both event types export with rich metadata:

**Work events (syllabus)**
- `SUMMARY` — assignment title
- `DESCRIPTION` — course name, type + estimated hours, description (e.g. `CS101 — Exam (est. 5 hrs) — Covers chapters 1-8`)
- `CATEGORIES` — assignment type in uppercase (e.g. `EXAM`, `ASSIGNMENT`)

**Fun events (places)**
- `SUMMARY` — place name
- `LOCATION` — formatted address (renders as a map link in Apple/Google Calendar)
- `DESCRIPTION` — category and distance (e.g. `Breakfast Spot · 300m away`)
- `URL` — Foursquare place link

---

## API Routes

### `POST /api/chat/`
```
Body:    { messages, mode, preferences: {location, budget, activity_type}, events: [{id, title, date}] }
Response: { reply: string, tool_calls: [{name, input}] }
```
Work mode: injects the current events list into the system prompt and provides calendar tools to Claude. Fun mode: injects user preferences and instructs Claude to output a SEARCH keyword.

### `POST /api/syllabus/parse`
```
Body:    multipart/form-data — PDF file
Response: { course_name, assignments: [{title, due_date, type, estimated_hours, description}] }
```
pdfplumber extracts text; Claude Haiku returns structured JSON.

### `POST /api/places/search`
```
Body:    { query, location, budget, activity_type, limit }
Response: { places: [{name, category, address, distance, url}], query, location }
```
Infers a Foursquare category ID from the query (falling back to `activity_type`), applies price filtering, queries Foursquare.

### `POST /api/calendar/export`
```
Body:    [{id, title, date, start, placeAddress, placeCategory, placeDistance, placeUrl,
           courseName, assignmentType, estimatedHours, assignmentDescription}]
Response: text/calendar file download (lifecal.ics)
```
Builds a valid RFC 5545 ICS file with metadata for both work and fun mode events.

---

## State (App.jsx)

```js
mode              // 'work' | 'fun'
events            // FullCalendar events array (includes metadata fields)
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
pip install fastapi uvicorn pdfplumber anthropic httpx python-dotenv python-multipart
cp .env.example .env          # set ANTHROPIC_API_KEY and FOURSQUARE_API_KEY
uvicorn main:app --reload     # runs on localhost:8000
```

---

## Deployment

| Step | Command |
|---|---|
| Deploy frontend | Push to `main` — Cloudflare Pages auto-deploys |
| Deploy backend | SSH into droplet → `git pull` → `pm2 restart lifecal-backend` |
| Frontend env vars | Set in Cloudflare Pages dashboard |
| Backend env vars | Edit `backend/.env` on the droplet |
