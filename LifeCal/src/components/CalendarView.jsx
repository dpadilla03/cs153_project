import { useRef, useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

function EventModal({ event, onClose }) {
  if (!event) return null

  const { title, start, allDay, backgroundColor } = event
  const { placeAddress, placeCategory, placeDistance, placeUrl } = event.extendedProps || {}

  const dateStr = start
    ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const timeStr = start && !allDay
    ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-color-bar" style={{ background: backgroundColor || '#6c8aff' }} />
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-content">
          <h3 className="modal-title">{title}</h3>
          {dateStr && (
            <p className="modal-date">{dateStr}{timeStr ? ` · ${timeStr}` : ''}</p>
          )}
          {placeCategory && <p className="modal-meta">{placeCategory}</p>}
          {placeAddress && <p className="modal-meta">📍 {placeAddress}</p>}
          {placeDistance && <p className="modal-meta">📏 {placeDistance}</p>}
          {placeUrl && (
            <a className="modal-link" href={placeUrl} target="_blank" rel="noopener noreferrer">
              View details →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarView({ events, mode, calendarDate }) {
  const calendarRef = useRef(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    if (calendarDate && calendarRef.current) {
      const api = calendarRef.current.getApi()
      api.gotoDate(calendarDate)
    }
  }, [calendarDate])

  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent.preventDefault()
    setSelectedEvent(clickInfo.event)
  }

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        }}
        events={events}
        height="100%"
        dayMaxEvents={3}
        eventColor={mode === 'work' ? '#6c8aff' : '#ff7a6c'}
        eventClick={handleEventClick}
        eventCursor="pointer"
      />
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}

export default CalendarView
