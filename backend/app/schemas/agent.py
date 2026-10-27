from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1)
    system_prompt: str | None = None
    voice: str | None = None
    llm_model: str | None = None
    language: str | None = None
    temperature: float | None = 0.7
    voice_speed: float | None = 1.0


class AgentUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    voice: str | None = None
    llm_model: str | None = None
    language: str | None = None
    temperature: float | None = None
    voice_speed: float | None = None
    is_active: bool | None = None


class AgentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    system_prompt: str | None
    voice: str | None
    llm_model: str | None
    language: str | None
    temperature: float | None = 0.7
    voice_speed: float | None = 1.0
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True