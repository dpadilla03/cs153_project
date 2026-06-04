from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

WORK_PROMPT = """You are LifeCal's work assistant. You help students manage their academic schedule.
You help with study planning, deadline tracking, and staying on top of coursework.
Be concise, practical, and encouraging. If the user mentions assignments or exams,
help them think through a realistic plan to complete them."""

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

class ChatRequest(BaseModel):
    messages: List[Message]
    mode: str  # 'work' or 'fun'
    preferences: Preferences = Preferences()

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.mode == "work":
        system = WORK_PROMPT
    else:
        prefs = request.preferences
        preferences_context = (
            f"User preferences: location={prefs.location}, "
            f"budget={prefs.budget}, interests={prefs.activity_type}"
        )
        system = FUN_PROMPT_BASE.format(preferences_context=preferences_context)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=messages
    )

    return ChatResponse(reply=response.content[0].text)