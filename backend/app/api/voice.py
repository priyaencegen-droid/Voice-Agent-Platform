import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.core.rate_limit import limiter
from app.models.voice import Voice
from app.schemas.voice import VoiceResponse
from app.services.cartesia_service import CartesiaService
from app.services.voice_service import get_all_voices
from app.services.voice_sync_service import sync_cartesia_voices

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/voices",
    tags=["Voices"],
)


class VoicePreviewRequest(BaseModel):
    voice_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=500)
    voice_speed: float = Field(default=1.0, ge=0.5, le=2.0)


@router.get(
    "",
    response_model=list[VoiceResponse],
)
def list_voices(
    search: str | None = None,
    gender: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_all_voices(db, search=search, gender=gender)


@router.post("/preview")
@limiter.limit("10/minute")
async def preview_voice(
    request: Request,
    payload: VoicePreviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Preview text cannot be empty")

    voice = (
        db.query(Voice)
        .filter(
            Voice.provider_voice_id == payload.voice_id,
            Voice.provider == "cartesia",
            Voice.is_active.is_(True),
            Voice.is_public.is_(True),
            Voice.language == "en",
        )
        .first()
    )
    if not voice:
        raise HTTPException(status_code=404, detail="Voice is unavailable")

    try:
        audio = await CartesiaService.synthesize_preview(
            voice.provider_voice_id,
            text,
            payload.voice_speed,
        )
    except Exception as exc:
        logger.exception("Failed to generate voice preview for voice_id=%s", payload.voice_id)
        raise HTTPException(
            status_code=502,
            detail="Could not generate voice preview. Please try again.",
        ) from exc

    return Response(content=audio, media_type="audio/wav")


@router.post("/sync")
async def sync_voices(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await sync_cartesia_voices(db)