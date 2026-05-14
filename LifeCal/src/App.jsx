import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import CalendarView from './components/CalendarView'
import ChatBox from './components/ChatBox'



function App() {
  const [mode, setMode] = useState('work')
  const [backendOnline, setBackendOnline] = useState(false)
  const [events, setEvents] = useState([])
  const [workMessages, setWorkMessages] = useState([{ role: 'assistant', content: "Hi! Upload a syllabus and I'll help you plan your schedule." }])
  const [funMessages, setFunMessages] = useState([{ role: 'assistant', content: "Hi! Tell me when you're free and I'll find something fun to do!" }])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [uploadStatus, setUploadStatus] = useState('idle') // idle | loading | done | error


  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    console.log('Uploading:', file.name) 
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post('http://localhost:8000/api/syllabus/parse', formData)
      const { course_name, assignments } = res.data 
      // Convert to FullCalendar event format
      const newEvents = assignments.map((a, i) => ({
        id: `syllabus-${i}`,
        title: `${a.title}`,
        date: a.due_date,
        backgroundColor: '#6c8aff',
        borderColor: '#6c8aff',
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
    axios.get('http://localhost:8000/')
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
            />
        </div>
      </main>
    </div>
  )
}

export default App