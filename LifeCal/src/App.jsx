import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import CalendarView from './components/CalendarView'


function App() {
  const [mode, setMode] = useState('work')
  const [backendOnline, setBackendOnline] = useState(false)
  const [events, setEvents] = useState([])


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
      </aside>

      <main className="main">
        <div className="calendar-area">
          <CalendarView events={events} mode={mode} />
        </div>

        <div className="chat-area">
          {/* Chat goes here after */}
          <p style={{ color: '#888' }}>Chat coming soon...</p>
        </div>
      </main>
    </div>
  )
}

export default App