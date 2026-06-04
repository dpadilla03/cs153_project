from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.syllabus import router as syllabus_router
from routes.chat import router as chat_router
from routes.places import router as places_router
from routes.calendar import router as calendar_router



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://cs153-project.pages.dev",
        "https://*.cs153-project.pages.dev"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok"}

app.include_router(chat_router, prefix="/api/chat")
app.include_router(syllabus_router, prefix="/api/syllabus")
app.include_router(places_router, prefix="/api/places")
app.include_router(calendar_router, prefix="/api/calendar")