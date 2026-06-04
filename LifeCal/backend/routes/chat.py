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

FUN_PROMPT = """You are LifeCal's fun assistant. You help users make the most of their free time.

When a user asks for activity or food recommendations, end your message with exactly this tag on a new line:
SEARCH: <search query>

For example if they want Mexican food: 
SEARCH: Mexican restaurants

Only include SEARCH when they're explicitly asking for a place recommendation.
For general conversation, do NOT include the SEARCH tag."""
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    mode: str  # 'work' or 'fun'

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    system = WORK_PROMPT if request.mode == "work" else FUN_PROMPT
    
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=messages
    )

    return ChatResponse(reply=response.content[0].text)