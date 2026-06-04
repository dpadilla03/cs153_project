from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")

class PlacesRequest(BaseModel):
    query: str                          # e.g. "coffee shops", "hiking", "restaurants"
    location: str                       # e.g. "Palo Alto, CA"
    budget: Optional[str] = "$$"       # $, $$, $$$, $$$$
    limit: int = 5

class Place(BaseModel):
    name: str
    category: str
    address: str
    distance: Optional[str] = ""
    price: Optional[str] = ""
    url: Optional[str] = ""

class PlacesResponse(BaseModel):
    places: List[Place]
    query: str
    location: str

@router.post("/search", response_model=PlacesResponse)
async def search_places(request: PlacesRequest):
    api_key = os.getenv("FOURSQUARE_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="Foursquare API key not set")

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json",
        "X-Places-Api-Version": "2025-06-17",
    }

    params = {
        "query": request.query,
        "near": request.location,
        "limit": request.limit,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            "https://places-api.foursquare.com/places/search",
            headers=headers,
            params=params,
        )

    print("Foursquare status:", res.status_code)
    print("Foursquare response:", res.text)

    if res.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Foursquare error {res.status_code}: {res.text}",
        )

    data = res.json()
    places = []

    for r in data.get("results", []):
        categories = r.get("categories") or []
        category = categories[0].get("name", "Place") if categories else "Place"

        loc = r.get("location") or {}
        address = loc.get("formatted_address", "Address unavailable")

        distance_value = r.get("distance")
        distance = f"{distance_value}m away" if distance_value is not None else ""

        fsq_id = r.get("fsq_place_id") or r.get("fsq_id") or ""

        places.append(Place(
            name=r.get("name", ""),
            category=category,
            address=address,
            distance=distance,
            url=f"https://foursquare.com/v/{fsq_id}" if fsq_id else "",
        ))

    return PlacesResponse(
        places=places,
        query=request.query,
        location=request.location,
    )