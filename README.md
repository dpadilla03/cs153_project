# LifeCal - CS153 Final Project

**Track:** Automation / Agent Systems

An AI-powered scheduling app with two modes: **Work Mode** parses a syllabus PDF and populates your calendar with deadlines; **Fun Mode** chats with you to find activities and places nearby.

**Live version:** [https://cs153-project.pages.dev/](https://cs153-project.pages.dev/)

---

## Problem & Motivation

Students and busy individuals constantly struggle with two related problems: keeping track of academic deadlines buried in dense syllabus PDFs, and figuring out how to actually use the free time they have. Existing tools solve these in isolation — calendar apps require manual entry, and recommendation apps know nothing about your schedule or stress level.

LifeCal addresses both sides with a single AI-powered agent system. The scheduling agent reads your syllabus and builds your calendar automatically. The activity agent finds real places nearby that match your preferences and budget. The two modes are intentionally separate — Work Mode handles academic deadlines, Fun Mode handles leisure planning.

---

## How It Works (Architecture)

LifeCal is an agent system with two specialized Claude-powered agents coordinating with external tools:

**Work Mode Agent**
1. User uploads a syllabus PDF
2. Backend extracts text via pdfplumber
3. Claude parses unstructured text into structured JSON (assignments, due dates, types, estimated hours)
4. Events populate FullCalendar and the view auto-navigates to the first deadline

**Fun Mode Agent**
1. User chats about what they want to do
2. Claude responds conversationally, then appends a controlled `SEARCH: <keyword>` tag when it decides a place search is warranted — this is the agentic tool-use decision
3. Frontend strips the tag, displays the clean response, and calls the Foursquare Places API
4. Results are filtered by the user's location, budget, and activity type preferences
5. Place cards are returned with an "Add to Calendar" option

The key design decision: Claude controls *when* to trigger the external tool call. It only appends `SEARCH:` when the user is actually asking for a recommendation, not during general conversation.

---

## Evaluation & Limitations

**What was tested:**
- Syllabus parser tested on 3 different course syllabi (CS107, CS153, and one external). Successfully extracted all deadlines with correct dates on well-formatted PDFs.
- Fun Mode tested with varied queries (food, outdoors, coffee, bars) across different budget levels. Foursquare results are accurate for the Palo Alto area.
- The `SEARCH:` tag approach was validated — Claude correctly withholds the tag during conversational exchanges and only triggers it on explicit recommendation requests.

**Known limitations:**
- Calendar state is not persisted — refreshing the page clears all events. A database (Cloudflare D1) would fix this.
- Syllabus parser struggles with scanned PDFs or heavily image-based layouts where pdfplumber cannot extract clean text.
- Fun Mode place results display with raw markdown syntax visible — a `react-markdown` integration would fix this.
- No Google Calendar or Apple Calendar sync — users can export events as `.ics` for manual import.
- Foursquare free tier limits category-based search, so very niche queries may not return relevant results.

---

## What I'd Add Next

- **Persistent storage** via Cloudflare D1 — save calendar events and chat history across sessions
- **Google/Apple Calendar sync** — push events directly via OAuth instead of `.ics` export
- **Proactive nudges** — agent detects upcoming deadlines and surfaces them in chat unprompted
- **Shared calendars** — two users' agents negotiate mutual free time, each respecting their own preferences
- **Richer preference learning** — agent tracks which suggestions the user accepted or ignored and adjusts future recommendations

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

Upload one or more syllabus PDFs. Each syllabus becomes its own course tab in the sidebar. The backend extracts text with pdfplumber, sends it to Claude Haiku with a structured prompt, and returns a JSON list of assignments with titles, due dates, types, and estimated hours. Each course is assigned a unique color from a rotating palette, and the calendar auto-navigates to the first deadline of the most recently uploaded course. After loading, the user can chat to modify that course's events — Claude can add, remove, reschedule, and rename events, and only sees events for the currently selected course tab.

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
Body:    { messages: [{role, content}], mode: "work"|"fun", preferences: {location, budget, activity_type}, events: [{id, title, date}] }
Response: { reply: string, tool_calls: [{name, input}] }
```
Claude is given a mode-aware system prompt and the relevant events list. It has access to four calendar tools: `add_event`, `remove_event`, `reschedule_event`, `rename_event`. In Fun Mode, Claude is also instructed to append a `SEARCH: <keyword>` tag when recommending places. Both modes decline requests unrelated to scheduling.

### `POST /api/calendar/export`
```
Body:    [{id, title, date, start, placeAddress, placeCategory, placeDistance, placeUrl,
           courseName, assignmentType, estimatedHours, assignmentDescription}]
Response: text/calendar file download (lifecal.ics)
```
Builds a valid RFC 5545 ICS file combining all course events and fun events into a single download.

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
courses           // array of { id, name, color, events[], messages[] } — one entry per uploaded syllabus
activeCourseId    // id of the currently selected course tab (Work Mode)
funEvents         // FullCalendar events array for Fun Mode
calendarDate      // auto-navigate calendar on event add
funMessages       // fun chat history (work chat history lives inside each course object)
preferences       // { location, budget, activity_type }
uploadStatus      // 'idle' | 'loading' | 'done' | 'error'

// derived
activeCourse      // courses.find(c => c.id === activeCourseId)
allEvents         // [...courses.flatMap(c => c.events), ...funEvents]
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

---

## AI Usage Disclosure

As required by the CS 153 AI policy, here is a full account of where AI tools were used in this project:

**Claude (Anthropic) — primary AI used throughout**
- `claude-sonnet-4-5` powers the Work Mode and Fun Mode chat agents at runtime
- `claude-haiku-4-5` is called at runtime by the syllabus parser to extract structured deadline data from PDF text
- Claude (claude.ai) was used extensively during development for code generation, debugging, architecture decisions, and writing this README. Essentially every file in this repo was written with Claude assistance in a pair-programming style — I directed the decisions, Claude helped implement them.

**Claude Code**
- Used in later stages of development for implementing the Foursquare Places integration, place card rendering, "Add to Calendar" feature, and `.ics` export functionality.

**Note on code originality:** All code was written from scratch for this project. No existing repos were forked or borrowed from. The commit history reflects the iterative development process over the course of the project.