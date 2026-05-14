import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [backendStatus, setBackendStatus] = useState('checking...')

  useEffect(() => {
    axios.get('http://localhost:8000/')
      .then(res => setBackendStatus(res.data.status))
      .catch(() => setBackendStatus('error — is the backend running?'))
  }, [])

  return (
    <div>
      <h1>LifeCal</h1>
      <p>Backend status: {backendStatus}</p>
    </div>
  )
}

export default App