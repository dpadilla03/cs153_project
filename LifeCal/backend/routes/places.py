from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")

# Foursquare category IDs — helps the API filter by type when text search is weak
_CATEGORY_MAP = [
    (["food", "eat", "restaurant", "breakfast", "brunch", "lunch", "dinner",
      "pizza", "burger", "sushi", "tacos", "mexican", "italian", "thai",
      "chinese", "japanese", "indian", "bistro", "bakery", "diner",
      "cuisine", "place to eat", "somewhere to eat"], "13000"),
    (["coffee", "cafe", "café", "tea", "espresso", "latte"], "13032"),
    (["bar", "drinks", "cocktail", "beer", "wine", "pub", "nightlife"], "13003"),
    (["escape", "escape room", "entertainment", "movie", "theater", "theatre",
      "cinema", "museum", "art", "gallery", "bowling", "arcade", "comedy",
      "concert", "show", "amusement", "zoo", "aquarium", "puzzle"], "10000"),
    (["park", "hike", "hiking", "trail", "outdoor", "nature", "garden",
      "beach", "lake", "camping", "picnic", "sports", "recreation"], "16000"),
    (["shop", "shopping", "store", "mall", "market", "boutique",
      "bookstore", "vintage", "thrift", "antique"], "17000"),
]

def _infer_category(query: str) -> str | None:
    q = query.lower()
    for keywords, cat_id in _CATEGORY_MAP:
        if any(kw in q for kw in keywords):
            return cat_id
    return None

class PlacesRequest(BaseModel):
    query: str
    location: str
    budget: Optional[str] = "$$"
    activity_type: Optional[str] = None
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

    category = _infer_category(request.query) or _infer_category(request.activity_type or "")
    if category:
        params["categories"] = category

    price_map = {"$": "1", "$$": "2", "$$$": "3", "$$$$": "4"}
    if request.budget in price_map:
        params["price"] = price_map[request.budget]

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