import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import CalendarView from './components/CalendarView'
import ChatBox from './components/ChatBox'
import API_BASE from './utils/api'
console.log('API_BASE is:', import.meta.env.VITE_API_URL)




function App() {
  const [mode, setMode] = useState('work')
  const [backendOnline, setBackendOnline] = useState(false)
  const [events, setEvents] = useState([])
  const [workMessages, setWorkMessages] = useState([{ role: 'assistant', content: "Hi! Upload a syllabus and I'll help you plan your schedule." }])
  const [funMessages, setFunMessages] = useState([{ role: 'assistant', content: "Hi! Tell me when you're free and I'll find something fun to do!" }])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [uploadStatus, setUploadStatus] = useState('idle') // idle | loading | done | error
  const [preferences, setPreferences] = useState({
    location: 'Palo Alto, CA',
    budget: '$$',
    activity_type: 'restaurants',
  })

  const handleCalendarAction = (toolCalls) => {
    toolCalls.forEach(tc => {
      if (tc.name === 'add_event') {
        setEvents(prev => [...prev, {
          id: `work-${Math.random().toString(36).slice(2)}`,
          title: tc.input.title,
          date: tc.input.date,
          backgroundColor: '#6c8aff',
          borderColor: '#6c8aff',
        }])
      } else if (tc.name === 'remove_event') {
        setEvents(prev => prev.filter(e => e.id !== tc.input.id))
      } else if (tc.name === 'reschedule_event') {
        setEvents(prev => prev.map(e =>
          e.id === tc.input.id
            ? { ...e, date: tc.input.new_date, start: undefined }
            : e
        ))
      }
    })
  }

  const handleExportIcs = async () => {
    if (events.length === 0) return
    const res = await axios.post(`${API_BASE}/api/calendar/export`, events, {
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
    setEvents(prev => [...prev, event])
    setCalendarDate(new Date(`${date}T12:00:00`))
  }


  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    console.log('Uploading:', file.name) 
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${API_BASE}/api/syllabus/parse`, formData)
      const { course_name, assignments } = res.data 
      // Convert to FullCalendar event format
      const newEvents = assignments.map((a, i) => ({
        id: `syllabus-${i}`,
        title: a.title,
        date: a.due_date,
        backgroundColor: '#6c8aff',
        borderColor: '#6c8aff',
        courseName: course_name,
        assignmentType: a.type,
        estimatedHours: a.estimated_hours,
        assignmentDescription: a.description || '',
      }))
      setEvents(prev => [...prev, ...newEvents])
      if (assignments.length > 0) {
        setCalendarDate(new Date(assignments[0].due_date + 'T12:00:00'))
      }
        setUploadStatus('done')
      console.log(`Parsed ${assignments.length} items from ${course_name}`)
    } catch (err) {
      console.error('Upload failed:', err)
          setUploadStatus('error')

    }
  }
  useEffect(() => {
    axios.get(`${API_BASE}/`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">

        {/* Backend status indicator */}
        <div className="backend-status">
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span className="status-text">
            {backendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
          </span>
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
        <div className="upload-section">
        <p className="section-label">Upload Syllabus</p>
        <input
            type="file"
            accept=".pdf"
            id="syllabus-input"
            style={{ display: 'none' }}
            onChange={handleSyllabusUpload}
            />
            <label htmlFor="syllabus-input" className={`upload-btn ${uploadStatus === 'loading' ? 'uploading' : ''}`}>
              {uploadStatus === 'idle' && '📄 Upload PDF'}
              {uploadStatus === 'loading' && '⏳ Parsing...'}
              {uploadStatus === 'done' && '✅ Uploaded!'}
              {uploadStatus === 'error' && '❌ Try again'}
              </label>
  </div>
)}
        {events.length > 0 && (
          <button className="export-btn" onClick={handleExportIcs}>
            ↓ Export .ics
          </button>
        )}
      </aside>

      <main className="main">
        <div className="calendar-area">
          <CalendarView events={events} mode={mode} calendarDate={calendarDate} />
        </div>

        <div className="chat-area">
            <ChatBox
  mode={mode}
  messages={mode === 'work' ? workMessages : funMessages}
  setMessages={mode === 'work' ? setWorkMessages : setFunMessages}
  preferences={preferences}
  apiBase={API_BASE}
  onAddToCalendar={handleAddToCalendar}
  events={events}
  onCalendarAction={handleCalendarAction}
/>
        </div>
      </main>
    </div>
  )
}

export default App