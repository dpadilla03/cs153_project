import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import API_BASE from '../utils/api'

function ChatBox({ mode, messages, setMessages, preferences, onAddToCalendar, events, onCalendarAction }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cardDates, setCardDates] = useState({})
  const [cardTimes, setCardTimes] = useState({})
  const bottomRef = useRef(null)
  const today = new Date().toISOString().split('T')[0]

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
        messages: [...messages, userMsg].filter(m => !m.type),
        mode,
        preferences,
        events: events
          .filter(e => mode === 'work'
            ? e.id?.startsWith('syllabus-') || e.id?.startsWith('work-')
            : e.id?.startsWith('fun-'))
          .map(e => ({ id: e.id, title: e.title, date: e.date, start: e.start })),
      })

      const reply = res.data.reply
      const toolCalls = res.data.tool_calls || []

      if (toolCalls.length > 0) {
        onCalendarAction?.(toolCalls, mode)
      }

      if (mode === 'fun' && reply.includes('SEARCH:')) {
        const searchQuery = reply.split('SEARCH:')[1].split('\n')[0].trim()
        const cleanReply = reply.split('SEARCH:')[0].trim()

        setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])

        if (preferences?.location) {
          const placesRes = await axios.post(`${API_BASE}/api/places/search`, {
            query: searchQuery,
            location: preferences.location,
            budget: preferences.budget,
            activity_type: preferences.activity_type,
            limit: 3
          })
          if (placesRes.data.places.length > 0) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              type: 'places',
              places: placesRes.data.places,
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
        {messages.map((msg, i) => {
          if (msg.type === 'places') {
            return (
              <div key={i} className="message assistant">
                <div className="place-cards">
                  <p className="places-header">Here are some options near you:</p>
                  {msg.places.map((place, j) => {
                    const key = `${i}-${j}`
                    const date = cardDates[key] || today
                    return (
                      <div key={j} className="place-card">
                        <div className="place-card-name">{place.name}</div>
                        <div className="place-card-meta">{place.category} · {place.address}</div>
                        {place.distance && <div className="place-card-distance">{place.distance}</div>}
                        <div className="place-card-footer">
                          <input
                            type="date"
                            className="place-date-input"
                            value={date}
                            onChange={e => setCardDates(prev => ({ ...prev, [key]: e.target.value }))}
                          />
                          <input
                            type="time"
                            className="place-time-input"
                            value={cardTimes[key] || ''}
                            placeholder="time"
                            onChange={e => setCardTimes(prev => ({ ...prev, [key]: e.target.value }))}
                          />
                          <button
                            className="place-add-btn"
                            onClick={() => onAddToCalendar?.(place, date, cardTimes[key] || null)}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }
          return (
            <div key={i} className={`message ${msg.role} ${msg.role === 'user' ? mode : ''}`}>
              <div className="bubble">{msg.content}</div>
            </div>
          )
        })}
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