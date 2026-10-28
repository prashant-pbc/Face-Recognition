from pydantic import BaseModel, Field


class PersonOut(BaseModel):
    id: int
    name: str
    person_id: str
    notes: str
    thumbnail_url: str = ""
    created_at: str


class PersonUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None


class AnalyzeIn(BaseModel):
    image: str
    challenge: str = "blink"
    signals: dict = Field(default_factory=dict)
    mode: str = "recognize"


class EnrollIn(BaseModel):
    name: str
    person_id: str
    notes: str = ""
    images: list[str]
    challenge: str = "blink"
    signals: dict = Field(default_factory=dict)
