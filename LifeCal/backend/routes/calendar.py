from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid

router = APIRouter()

class CalendarEvent(BaseModel):
    id: Optional[str] = None
    title: str
    date: Optional[str] = None
    start: Optional[str] = None
    # fun mode place metadata
    placeAddress: Optional[str] = None
    placeCategory: Optional[str] = None
    placeDistance: Optional[str] = None
    placeUrl: Optional[str] = None
    # work mode syllabus metadata
    courseName: Optional[str] = None
    assignmentType: Optional[str] = None
    estimatedHours: Optional[int] = None
    assignmentDescription: Optional[str] = None

def _esc(text: str) -> str:
    """Escape special characters per RFC 5545."""
    return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")

def _event_times(event: CalendarEvent) -> tuple[str, str]:
    if event.start:
        dt = datetime.fromisoformat(event.start)
        return (
            f"DTSTART:{dt.strftime('%Y%m%dT%H%M%S')}",
            f"DTEND:{(dt + timedelta(hours=1)).strftime('%Y%m%dT%H%M%S')}",
        )
    d = date.fromisoformat(event.date)
    return (
        f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}",
        f"DTEND;VALUE=DATE:{(d + timedelta(days=1)).strftime('%Y%m%d')}",
    )

@router.post("/export")
async def export_calendar(events: List[CalendarEvent]):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LifeCal//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for event in events:
        if not event.date and not event.start:
            continue
        dtstart, dtend = _event_times(event)
        vevent = [
            "BEGIN:VEVENT",
            f"UID:{uuid.uuid4()}@lifecal",
            dtstart,
            dtend,
            f"SUMMARY:{_esc(event.title)}",
        ]
        if event.placeAddress:
            vevent.append(f"LOCATION:{_esc(event.placeAddress)}")
        if event.placeCategory or event.placeDistance:
            parts = [p for p in [event.placeCategory, event.placeDistance] if p]
            vevent.append(f"DESCRIPTION:{_esc(' · '.join(parts))}")
        if event.placeUrl:
            vevent.append(f"URL:{event.placeUrl}")
        if event.assignmentType or event.courseName or event.assignmentDescription:
            desc_parts = []
            if event.courseName:
                desc_parts.append(event.courseName)
            if event.assignmentType:
                type_label = event.assignmentType.capitalize()
                if event.estimatedHours:
                    type_label += f" (est. {event.estimatedHours} hrs)"
                desc_parts.append(type_label)
            if event.assignmentDescription:
                desc_parts.append(event.assignmentDescription)
            vevent.append(f"DESCRIPTION:{_esc(' — '.join(desc_parts))}")
        if event.assignmentType:
            vevent.append(f"CATEGORIES:{_esc(event.assignmentType.upper())}")
        vevent.append("END:VEVENT")
        lines += vevent

    lines.append("END:VCALENDAR")
    ics = "\r\n".join(lines) + "\r\n"

    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=lifecal.ics"},
    )
