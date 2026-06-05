import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import CalendarView from './components/CalendarView'
import ChatBox from './components/ChatBox'
import API_BASE from './utils/api'

const COURSE_COLORS = [
  '#6c8aff', '#4caf87', '#f5a623', '#e05252',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e8c',
]

function App() {
  const [mode, setMode] = useState('work')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [backendOnline, setBackendOnline] = useState(false)

  // Work: per-course event storage
  const [courses, setCourses] = useState([])
  const [activeCourseId, setActiveCourseId] = useState(null) // null = All Classes

  // Fun: separate event pool
  const [funEvents, setFunEvents] = useState([])

  const [workMessages, setWorkMessages] = useState([{ role: 'assistant', content: "Hi! Upload a syllabus and I'll help you plan your schedule." }])
  const [funMessages, setFunMessages] = useState([{ role: 'assistant', content: "Hi! Tell me when you're free and I'll find something fun to do!" }])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [uploadStatus, setUploadStatus] = useState('idle') // idle | loading | done | error
  const [preferences, setPreferences] = useState({
    location: 'Palo Alto, CA',
    budget: '$$',
    activity_type: 'restaurants',
  })

  // All events shown on the calendar
  const allEvents = [...courses.flatMap(c => c.events), ...funEvents]

  // The currently selected course object (null when "All" is selected)
  const activeCourse = courses.find(c => c.id === activeCourseId) ?? null

  // Events sent to the chat as context
  const chatContextEvents = mode === 'work'
    ? (activeCourse ? activeCourse.events : courses.flatMap(c => c.events))
    : funEvents

  // ─── Calendar action handler (called by ChatBox after tool calls) ───────────
  const handleCalendarAction = (toolCalls) => {
    toolCalls.forEach(tc => {
      if (tc.name === 'add_event') {
        const color = activeCourse?.color ?? '#6c8aff'
        const newEvent = {
          id: `work-${Math.random().toString(36).slice(2)}`,
          title: tc.input.title,
          backgroundColor: color,
          borderColor: color,
          courseId: activeCourseId ?? 'misc',
        }
        if (tc.input.time) {
          newEvent.start = `${tc.input.date}T${tc.input.time}`
          if (tc.input.end_time) newEvent.end = `${tc.input.date}T${tc.input.end_time}`
        } else {
          newEvent.date = tc.input.date
        }

        if (activeCourseId) {
          setCourses(prev => prev.map(c =>
            c.id === activeCourseId ? { ...c, events: [...c.events, newEvent] } : c
          ))
        } else {
          // No course selected — put in a catch-all "General" course
          setCourses(prev => {
            const miscIdx = prev.findIndex(c => c.id === 'misc')
            if (miscIdx >= 0) {
              return prev.map(c => c.id === 'misc' ? { ...c, events: [...c.events, newEvent] } : c)
            }
            return [...prev, { id: 'misc', name: 'General', color: '#888888', events: [newEvent] }]
          })
        }

      } else if (tc.name === 'remove_event') {
        setCourses(prev => prev.map(c => ({
          ...c, events: c.events.filter(e => e.id !== tc.input.id),
        })))
        setFunEvents(prev => prev.filter(e => e.id !== tc.input.id))

      } else if (tc.name === 'reschedule_event') {
        const patch = (e) => {
          if (e.id !== tc.input.id) return e
          const updated = { ...e }
          if (tc.input.new_time) {
            updated.start = `${tc.input.new_date}T${tc.input.new_time}`
            if (tc.input.new_end_time) updated.end = `${tc.input.new_date}T${tc.input.new_end_time}`
            delete updated.date
          } else {
            updated.date = tc.input.new_date
            delete updated.start
            delete updated.end
          }
          return updated
        }
        setCourses(prev => prev.map(c => ({ ...c, events: c.events.map(patch) })))
        setFunEvents(prev => prev.map(patch))

      } else if (tc.name === 'rename_event') {
        const patch = (e) => e.id === tc.input.id ? { ...e, title: tc.input.new_title } : e
        setCourses(prev => prev.map(c => ({ ...c, events: c.events.map(patch) })))
        setFunEvents(prev => prev.map(patch))
      }
    })
  }

  // ─── Fun mode: add place to calendar ────────────────────────────────────────
  const handleAddToCalendar = (place, date, time) => {
    const event = {
      id: `fun-${Math.random().toString(36).slice(2)}`,
      title: place.name,
      backgroundColor: '#ff7a6c',
      borderColor: '#ff7a6c',
      placeAddress: place.address || '',
      placeCategory: place.category || '',
      placeDistance: place.distance || '',
      placeUrl: place.url || '',
    }
    if (time) {
      event.start = `${date}T${time}`
    } else {
      event.date = date
    }
    setFunEvents(prev => [...prev, event])
    setCalendarDate(new Date(`${date}T12:00:00`))
  }

  // ─── Syllabus upload ─────────────────────────────────────────────────────────
  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = '' // allow re-uploading same file
    const formData = new FormData()
    formData.append('file', file)
    setUploadStatus('loading')
    try {
      const res = await axios.post(`${API_BASE}/api/syllabus/parse`, formData)
      const { course_name, assignments } = res.data
      const color = COURSE_COLORS[courses.length % COURSE_COLORS.length]
      const courseId = `course-${Date.now()}`
      const newEvents = assignments.map((a, i) => ({
        id: `${courseId}-${i}`,
        title: a.title,
        date: a.due_date,
        backgroundColor: color,
        borderColor: color,
        courseId,
        assignmentType: a.type,
        estimatedHours: a.estimated_hours,
        description: a.description || '',
      }))
      const newCourse = { id: courseId, name: course_name, color, events: newEvents }
      setCourses(prev => [...prev, newCourse])
      setActiveCourseId(courseId)
      if (assignments.length > 0) {
        setCalendarDate(new Date(assignments[0].due_date + 'T12:00:00'))
      }
      setUploadStatus('done')
      setTimeout(() => setUploadStatus('idle'), 3000)
    } catch (err) {
      console.error('Upload failed:', err)
      setUploadStatus('error')
      setTimeout(() => setUploadStatus('idle'), 3000)
    }
  }

  // ─── ICS export ──────────────────────────────────────────────────────────────
  const handleExportIcs = async () => {
    if (allEvents.length === 0) return
    const res = await axios.post(`${API_BASE}/api/calendar/export`, allEvents, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lifecal.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    axios.get(`${API_BASE}/`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">

        {/* Sidebar header: status + theme toggle */}
        <div className="sidebar-header">
          <div className="backend-status">
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <span className="status-text">
              {backendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
            </span>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '☽'}
          </button>
        </div>

        <h1 className="logo">LifeCal</h1>

        <div className="mode-toggle">
          <button
            className={mode === 'work' ? 'active-work' : ''}
            onClick={() => setMode('work')}
          >
            📚 Work
          </button>
          <button
            className={mode === 'fun' ? 'active-fun' : ''}
            onClick={() => setMode('fun')}
          >
            🎉 Fun
          </button>
        </div>

        <p className="mode-label">
          {mode === 'work' ? 'Manage deadlines & study schedule' : 'Find something fun to do'}
        </p>

        {/* ── Fun preferences ── */}
        {mode === 'fun' && (
          <div className="upload-section">
            <p className="section-label">Your Preferences</p>
            <div className="pref-field">
              <label className="pref-label">Location</label>
              <input
                className="pref-input"
                value={preferences.location}
                onChange={e => setPreferences(p => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div className="pref-field">
              <label className="pref-label">Budget</label>
              <select
                className="pref-input"
                value={preferences.budget}
                onChange={e => setPreferences(p => ({ ...p, budget: e.target.value }))}
              >
                {['$', '$$', '$$$', '$$$$'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="pref-field">
              <label className="pref-label">Looking for</label>
              <select
                className="pref-input"
                value={preferences.activity_type}
                onChange={e => setPreferences(p => ({ ...p, activity_type: e.target.value }))}
              >
                <option value="restaurants">Food & Drink</option>
                <option value="parks outdoors">Outdoors</option>
                <option value="entertainment">Entertainment</option>
                <option value="coffee shops">Coffee</option>
                <option value="shopping">Shopping</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Work: upload + course tabs ── */}
        {mode === 'work' && (
          <>
            <div className="upload-section">
              <p className="section-label">Upload Syllabus</p>
              <input
                type="file"
                accept=".pdf"
                id="syllabus-input"
                style={{ display: 'none' }}
                onChange={handleSyllabusUpload}
              />
              <label
                htmlFor="syllabus-input"
                className={`upload-btn ${uploadStatus === 'loading' ? 'uploading' : ''}`}
              >
                {uploadStatus === 'idle'    && '📄 Upload PDF'}
                {uploadStatus === 'loading' && '⏳ Parsing...'}
                {uploadStatus === 'done'    && '✅ Uploaded!'}
                {uploadStatus === 'error'   && '❌ Try again'}
              </label>
            </div>

            {courses.length > 0 && (
              <div className="course-tabs-section">
                <p className="section-label">Your Classes</p>
                <div className="course-tabs">
                  <button
                    className={`course-tab ${activeCourseId === null ? 'active' : ''}`}
                    onClick={() => setActiveCourseId(null)}
                  >
                    <span className="course-dot" style={{ background: '#888888' }} />
                    <span className="course-tab-name">All Classes</span>
                  </button>
                  {courses.map(c => (
                    <button
                      key={c.id}
                      className={`course-tab ${activeCourseId === c.id ? 'active' : ''}`}
                      onClick={() => setActiveCourseId(c.id)}
                      title={c.name}
                    >
                      <span className="course-dot" style={{ background: c.color }} />
                      <span className="course-tab-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {allEvents.length > 0 && (
          <button className="export-btn" onClick={handleExportIcs}>
            ↓ Export .ics
          </button>
        )}
      </aside>

      <main className="main">
        <div className="calendar-area">
          <CalendarView events={allEvents} mode={mode} calendarDate={calendarDate} />
        </div>

        <div className="chat-area">
          <ChatBox
            mode={mode}
            messages={mode === 'work' ? workMessages : funMessages}
            setMessages={mode === 'work' ? setWorkMessages : setFunMessages}
            preferences={preferences}
            onAddToCalendar={handleAddToCalendar}
            onCalendarAction={handleCalendarAction}
            contextEvents={chatContextEvents}
            courseName={activeCourse?.name ?? null}
          />
        </div>
      </main>
    </div>
  )
}

export default App
