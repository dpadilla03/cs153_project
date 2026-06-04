import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import API_BASE from '../utils/api'

// test
function ChatBox({ mode, messages, setMessages, preferences }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

   const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await axios.post(`${API_BASE}/api/chat/`, {
        messages: [...messages, userMsg],
        mode,
        preferences
      })

      const reply = res.data.reply

      if (mode === 'fun' && reply.includes('SEARCH:')) {
        const searchQuery = reply.split('SEARCH:')[1].trim()
        const cleanReply = reply.split('SEARCH:')[0].trim()

        setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])

        if (preferences?.location) {
          const placesRes = await axios.post(`${API_BASE}/api/places/search`, {
            query: searchQuery,
            location: preferences.location,
            budget: preferences.budget,
            limit: 3
          })
          if (placesRes.data.places.length > 0) {
            const placesList = placesRes.data.places
              .map(p => `📍 **${p.name}** (${p.category}) — ${p.address} ${p.distance}`)
              .join('\n')
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Here are some options near you:\n${placesList}`
            }])
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    }catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not reach backend. Is it running?'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chatbox">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role} ${msg.role === 'user' ? mode : ''}`}>
            <div className="bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="bubble typing">●●●</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className={`chat-input ${mode}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'work' ? 'Ask about your schedule...' : 'What are you in the mood for?'}
          rows={1}
        />
        <button
          className={`send-btn ${mode}`}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default ChatBox