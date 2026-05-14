import { useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

function CalendarView({ events, mode, calendarDate }) {
  const calendarRef = useRef(null)

  useEffect(() => {
    if (calendarDate && calendarRef.current) {
      const api = calendarRef.current.getApi()
      api.gotoDate(calendarDate)
    }
  }, [calendarDate])

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
      />
    </div>
  )
}

export default CalendarView