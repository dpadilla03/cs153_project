from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

WORK_PROMPT_BASE = """You are LifeCal's work assistant. You help students manage their academic schedule.
You help with study planning, deadline tracking, and staying on top of coursework.
Be concise, practical, and encouraging.

You have tools to modify the user's calendar: add_event, remove_event, reschedule_event.
Use them when the user asks to add, remove, or move events. Always include a short plain-text explanation alongside any tool call so the user knows what you did.

{events_context}"""

CALENDAR_TOOLS = [
    {
        "name": "add_event",
        "description": "Add a new event to the user's calendar.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Event title"},
                "date":  {"type": "string", "description": "Date in YYYY-MM-DD format"},
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
        "description": "Move a calendar event to a new date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id":       {"type": "string", "description": "The event ID to reschedule"},
                "new_date": {"type": "string", "description": "New date in YYYY-MM-DD format"},
            },
            "required": ["id", "new_date"],
        },
    },
]

FUN_PROMPT_BASE = """You are LifeCal's fun assistant. You help users make the most of their free time.

{preferences_context}

When a user asks for activity or food recommendations, end your message with exactly this tag on a new line:
SEARCH: <category keyword>

The category keyword MUST be one of these exact terms so the search works correctly:
- Food & drink (any meal, cuisine, snacks): use "restaurant"
- Breakfast or brunch specifically: use "breakfast"
- Coffee or tea: use "coffee"
- Bars, drinks, nightlife: use "bar"
- Escape rooms, movies, theaters, museums, bowling, arcades, comedy: use "entertainment"
- Hiking, parks, outdoors, nature, beaches: use "outdoor"
- Shopping, stores, markets: use "shopping"

Examples:
- User wants Mexican food → SEARCH: restaurant
- User wants escape rooms → SEARCH: entertainment
- User wants a morning activity → SEARCH: breakfast
- User wants to go hiking → SEARCH: outdoor

Only include SEARCH when they're explicitly asking for a place recommendation.
For general conversation, do NOT include the SEARCH tag."""

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

class ChatResponse(BaseModel):
    reply: str
    tool_calls: List[ToolCall] = []

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.mode == "work":
        if request.events:
            events_list = "\n".join(
                f"- [{e.id}] {e.title} on {e.date or e.start}"
                for e in request.events
            )
            events_context = f"Current calendar events:\n{events_list}"
        else:
            events_context = "The calendar is empty."
        system = WORK_PROMPT_BASE.format(events_context=events_context)
    else:
        prefs = request.preferences
        preferences_context = (
            f"User preferences: location={prefs.location}, "
            f"budget={prefs.budget}, interests={prefs.activity_type}"
        )
        system = FUN_PROMPT_BASE.format(preferences_context=preferences_context)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    kwargs: Dict[str, Any] = dict(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    if request.mode == "work":
        kwargs["tools"] = CALENDAR_TOOLS

    response = client.messages.create(**kwargs)

    text_blocks = [b for b in response.content if b.type == "text"]
    tool_blocks = [b for b in response.content if b.type == "tool_use"]

    reply = text_blocks[0].text if text_blocks else ""
    tool_calls = [ToolCall(name=b.name, input=b.input) for b in tool_blocks]

    return ChatResponse(reply=reply, tool_calls=tool_calls)