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
            onChange={(e) => console.log('File selected:', e.target.files[0]?.name)}
            />
    <label htmlFor="syllabus-input" className="upload-btn">
      📄 Upload PDF
    </label>
  </div>
)}
      </aside>

      <main className="main">
        <div className="calendar-area">
          <CalendarView events={events} mode={mode} />
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