from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

WORK_PROMPT_BASE = """You are LifeCal's scheduling assistant. You ONLY help with calendar and scheduling tasks:
- Adding deadlines, study blocks, or any calendar events
- Removing or rescheduling existing events
- Renaming events
- Planning study schedules around deadlines based on the user's availability

If the user asks about anything unrelated to scheduling (homework help, general questions, fun activities, etc.), politely decline:
"I'm your scheduling assistant — I can only help with calendar and time management tasks."

{course_context}

{events_context}

When adding multiple study blocks, use the add_event tool once per block. Always confirm what you added in plain text after your tool calls. Be concise."""

FUN_PROMPT_BASE = """You are LifeCal's fun assistant. You help users make the most of their free time.

{preferences_context}

{events_context}

When a user asks for activity or food recommendations, end your message with exactly this tag on a new line:
SEARCH: <category keyword>

The category keyword MUST be one of these exact terms:
- Food & drink (any meal, cuisine, snacks): use "restaurant"
- Breakfast or brunch specifically: use "breakfast"
- Coffee or tea: use "coffee"
- Bars, drinks, nightlife: use "bar"
- Escape rooms, movies, theaters, museums, bowling, arcades, comedy: use "entertainment"
- Hiking, parks, outdoors, nature, beaches: use "outdoor"
- Shopping, stores, markets: use "shopping"

Only include SEARCH when explicitly asked for a place recommendation.
For general conversation, do NOT include the SEARCH tag.
Do not discuss work, academics, or scheduling — only free-time activities.

You have tools to manage the user's fun calendar: add_event, remove_event, reschedule_event."""

CALENDAR_TOOLS = [
    {
        "name": "add_event",
        "description": "Add a new event to the calendar (deadline, study block, reminder, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Event title"},
                "date":  {"type": "string", "description": "Date in YYYY-MM-DD format"},
                "time":  {"type": "string", "description": "Start time in HH:MM 24-hour format. Omit for all-day events."},
                "end_time": {"type": "string", "description": "End time in HH:MM 24-hour format. Omit if not applicable."},
            },
            "required": ["title", "date"],
        },
    },
    {
        "name": "remove_event",
        "description": "Remove a calendar event by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "The event ID to remove"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "reschedule_event",
        "description": "Move a calendar event to a new date and/or time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id":          {"type": "string", "description": "The event ID to reschedule"},
                "new_date":    {"type": "string", "description": "New date in YYYY-MM-DD format"},
                "new_time":    {"type": "string", "description": "New start time in HH:MM 24-hour format. Omit to keep all-day."},
                "new_end_time":{"type": "string", "description": "New end time in HH:MM 24-hour format. Optional."},
            },
            "required": ["id", "new_date"],
        },
    },
    {
        "name": "rename_event",
        "description": "Rename an existing calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id":        {"type": "string", "description": "The event ID to rename"},
                "new_title": {"type": "string", "description": "The new title for the event"},
            },
            "required": ["id", "new_title"],
        },
    },
]


class Message(BaseModel):
    role: str
    content: str = ""

class Preferences(BaseModel):
    location: str = "nearby"
    budget: str = "$$"
    activity_type: str = "activities"

class EventSummary(BaseModel):
    id: str
    title: str
    date: Optional[str] = None
    start: Optional[str] = None

class ToolCall(BaseModel):
    name: str
    input: Dict[str, Any]

class ChatRequest(BaseModel):
    messages: List[Message]
    mode: str
    preferences: Preferences = Preferences()
    events: List[EventSummary] = []
    course_name: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    tool_calls: List[ToolCall] = []


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.mode == "work":
        course_context = (
            f"You are currently managing the schedule for: {request.course_name}"
            if request.course_name
            else "You are viewing all courses combined. The user has not selected a specific course."
        )
        if request.events:
            events_list = "\n".join(
                f"  - [{e.id}] {e.title} on {e.date or e.start}"
                for e in request.events
            )
            events_context = f"Current calendar events:\n{events_list}"
        else:
            events_context = "No events on the calendar yet for this course."
        system = WORK_PROMPT_BASE.format(
            course_context=course_context,
            events_context=events_context,
        )
        tools = CALENDAR_TOOLS
    else:
        prefs = request.preferences
        preferences_context = (
            f"User preferences: location={prefs.location}, "
            f"budget={prefs.budget}, interests={prefs.activity_type}"
        )
        if request.events:
            events_list = "\n".join(
                f"  - [{e.id}] {e.title} on {e.date or e.start}"
                for e in request.events
            )
            events_context = f"Fun events already on the calendar:\n{events_list}"
        else:
            events_context = "No fun events on the calendar yet."
        system = FUN_PROMPT_BASE.format(
            preferences_context=preferences_context,
            events_context=events_context,
        )
        tools = CALENDAR_TOOLS

    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    all_tool_calls: List[ToolCall] = []

    # Agentic tool-use loop — keeps running until Claude stops calling tools
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=system,
            messages=messages,
            tools=tools,
        )

        tool_blocks = [b for b in response.content if b.type == "tool_use"]
        text_blocks  = [b for b in response.content if b.type == "text"]

        if response.stop_reason == "tool_use" and tool_blocks:
            all_tool_calls.extend(
                ToolCall(name=b.name, input=b.input) for b in tool_blocks
            )
            tool_results = [
                {"type": "tool_result", "tool_use_id": b.id, "content": "Action completed."}
                for b in tool_blocks
            ]
            messages = messages + [
                {"role": "assistant", "content": response.content},
                {"role": "user",      "content": tool_results},
            ]
        else:
            reply = text_blocks[0].text if text_blocks else ""
            return ChatResponse(reply=reply, tool_calls=all_tool_calls)
