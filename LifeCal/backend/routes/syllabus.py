from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pdfplumber
import anthropic
import os
import json
import io
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# --- Data models ---
# These are easy to swap to D1 later, just add an id field and store them

class Assignment(BaseModel):
    title: str
    due_date: str        # YYYY-MM-DD
    type: str            # assignment | exam | reading | project
    estimated_hours: int
    description: Optional[str] = ""

class ParseResponse(BaseModel):
    course_name: str
    assignments: List[Assignment]

# --- Helper: extract text from PDF ---

def extract_pdf_text(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

# --- Route ---

@router.post("/parse", response_model=ParseResponse)
async def parse_syllabus(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDFs supported")

    file_bytes = await file.read()
    raw_text = extract_pdf_text(file_bytes)

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from PDF")

    # Call Claude to parse the syllabus
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""Extract all assignments, exams, and deadlines from this syllabus.

Return ONLY valid JSON, no other text, in exactly this format:
{{
  "course_name": "Course name here",
  "assignments": [
    {{
      "title": "Name of assignment or exam",
      "due_date": "YYYY-MM-DD",
      "type": "assignment|exam|reading|project",
      "estimated_hours": 2,
      "description": "Brief description if available"
    }}
  ]
}}

Rules:
- If no year is specified assume 2025
- Only include items with clear due dates
- estimated_hours: exam=5, project=10, assignment=2, reading=1
- type must be one of: assignment, exam, reading, project

Syllabus:
{raw_text[:8000]}
"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    print("Claude response:", response.content[0].text)

    try:
        raw = response.content[0].text
        # Strip markdown code blocks if Claude added them
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        
        parsed = json.loads(raw)
        return ParseResponse(
            course_name=parsed["course_name"],
            assignments=[Assignment(**a) for a in parsed["assignments"]]
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse response: {str(e)}")