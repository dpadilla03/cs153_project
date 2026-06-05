import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import CalendarView from './components/CalendarView'
import ChatBox from './components/ChatBox'
import API_BASE from './utils/api'
console.log('API_BASE is:', import.meta.env.VITE_API_URL)

const COURSE_COLORS = [
  '#6c8aff', '#f59e0b', '#10b981', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
]

function App() {
  const [mode, setMode] = useState('work')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [backendOnline, setBackendOnline] = useState(false)
  const [courses, setCourses] = useState([])
  const [activeCourseId, setActiveCourseId] = useState(null)
  const [funEvents, setFunEvents] = useState([])
  const [funMessages, setFunMessages] = useState([{ role: 'assistant', content: "Hi! Tell me when you're free and I'll find something fun to do!" }])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [preferences, setPreferences] = useState({
    location: 'Palo Alto, CA',
    budget: '$$',
    activity_type: 'restaurants',
  })

  const activeCourse = courses.find(c => c.id === activeCourseId) || null
  const allEvents = [...courses.flatMap(c => c.events), ...funEvents]

  const handleCalendarAction = (toolCalls, callMode, courseId = null) => {
    const isFun = callMode === 'fun'
    toolCalls.forEach(tc => {
      if (tc.name === 'add_event') {
        const course = courses.find(c => c.id === courseId)
        const color = course?.color || '#6c8aff'
        const newEvent = {
          id: `${isFun ? 'fun' : 'work'}-${Math.random().toString(36).slice(2)}`,
          title: tc.input.title,
          backgroundColor: isFun ? '#ff7a6c' : color,
          borderColor: isFun ? '#ff7a6c' : color,
          courseName: course?.name || '',
          courseId: courseId || '',
        }
        if (tc.input.time) {
          newEvent.start = `${tc.input.date}T${tc.input.time}`
        } else {
          newEvent.date = tc.input.date
        }
        if (isFun) {
          setFunEvents(prev => [...prev, newEvent])
        } else {
          setCourses(prev => prev.map(c =>
            c.id === courseId ? { ...c, events: [...c.events, newEvent] } : c
          ))
        }
      } else if (tc.name === 'remove_event') {
        if (isFun) {
          setFunEvents(prev => prev.filter(e => e.id !== tc.input.id))
        } else {
          setCourses(prev => prev.map(c => ({
            ...c,
            events: c.events.filter(e => e.id !== tc.input.id)
          })))
        }
      } else if (tc.name === 'reschedule_event') {
        const update = (e) => {
          if (e.id !== tc.input.id) return e
          const updated = { ...e }
          if (tc.input.new_time) {
            updated.start = `${tc.input.new_date}T${tc.input.new_time}`
            delete updated.date
          } else {
            updated.date = tc.input.new_date
            delete updated.start
          }
          return updated
        }
        if (isFun) {
          setFunEvents(prev => prev.map(update))
        } else {
          setCourses(prev => prev.map(c => ({ ...c, events: c.events.map(update) })))
        }
      } else if (tc.name === 'rename_event') {
        const rename = (e) => e.id === tc.input.id ? { ...e, title: tc.input.new_title } : e
        if (isFun) {
          setFunEvents(prev => prev.map(rename))
        } else {
          setCourses(prev => prev.map(c => ({ ...c, events: c.events.map(rename) })))
        }
      }
    })
  }

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

  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploadStatus('loading')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${API_BASE}/api/syllabus/parse`, formData)
      const { course_name, assignments } = res.data
      const courseId = `course-${Math.random().toString(36).slice(2)}`
      const color = COURSE_COLORS[courses.length % COURSE_COLORS.length]
      const newEvents = assignments.map((a, i) => ({
        id: `syllabus-${courseId}-${i}`,
        title: a.title,
        date: a.due_date,
        backgroundColor: color,
        borderColor: color,
        courseName: course_name,
        courseId,
        assignmentType: a.type,
        estimatedHours: a.estimated_hours,
        assignmentDescription: a.description || '',
      }))
      const newCourse = {
        id: courseId,
        name: course_name,
        color,
        events: newEvents,
        messages: [{
          role: 'assistant',
          content: `Loaded ${course_name} — ${assignments.length} items on your calendar. Ask me to add study sessions, move deadlines, rename events, or anything else scheduling-related.`,
        }],
      }
      setCourses(prev => [...prev, newCourse])
      setActiveCourseId(courseId)
      if (assignments.length > 0) {
        setCalendarDate(new Date(assignments[0].due_date + 'T12:00:00'))
      }
      setUploadStatus('done')
      setTimeout(() => setUploadStatus('idle'), 2000)
    } catch (err) {
      console.error('Upload failed:', err)
      setUploadStatus('error')
      setTimeout(() => setUploadStatus('idle'), 3000)
    }
  }

  useEffect(() => {
    axios.get(`${API_BASE}/`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  const workMessages = activeCourse?.messages || [{ role: 'assistant', content: "Hi! Upload a syllabus and I'll help you plan your schedule." }]
  const setWorkMessages = (updater) => {
    if (!activeCourseId) return
    setCourses(prev => prev.map(c =>
      c.id === activeCourseId
        ? { ...c, messages: typeof updater === 'function' ? updater(c.messages) : updater }
        : c
    ))
  }

  return (
    <div className="app">
      <aside className="sidebar">

        {/* Sidebar header row */}
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

        {/* Mode Toggle */}
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

        {mode === 'work' && (
          <>
            {courses.length > 0 && (
              <div className="courses-section">
                <p className="section-label">Your Courses</p>
                {courses.map(course => (
                  <button
                    key={course.id}
                    className={`course-tab ${activeCourseId === course.id ? 'active' : ''}`}
                    onClick={() => setActiveCourseId(course.id)}
                  >
                    <span className="course-color-dot" style={{ background: course.color }} />
                    <span className="course-tab-name">{course.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="upload-section">
              <p className="section-label">{courses.length === 0 ? 'Upload Syllabus' : 'Add Course'}</p>
              <input
                type="file"
                accept=".pdf"
                id="syllabus-input"
                style={{ display: 'none' }}
                onChange={handleSyllabusUpload}
              />
              <label htmlFor="syllabus-input" className={`upload-btn ${uploadStatus === 'loading' ? 'uploading' : ''}`}>
                {uploadStatus === 'idle' && (courses.length === 0 ? '📄 Upload PDF' : '📄 Add Course')}
                {uploadStatus === 'loading' && '⏳ Parsing...'}
                {uploadStatus === 'done' && '✅ Uploaded!'}
                {uploadStatus === 'error' && '❌ Try again'}
              </label>
            </div>
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
            apiBase={API_BASE}
            onAddToCalendar={handleAddToCalendar}
            events={mode === 'work' ? (activeCourse?.events || []) : funEvents}
            onCalendarAction={(toolCalls, callMode) => handleCalendarAction(toolCalls, callMode, activeCourseId)}
          />
        </div>
      </main>
    </div>
  )
}

export default App
