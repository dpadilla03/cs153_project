import { useState } from 'react'

function ChatBox({ mode, messages, setMessages }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Backend not connected yet — coming soon!'
      }])
      setLoading(false)
    }, 500)
  }
  // rest stays the same...

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
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatBox