from sqlalchemy.orm import Session

from app.models.voice import Voice
from app.services.cartesia_service import CartesiaService


def normalize_gender(raw_gender: str | None, description: str | None = None) -> str:
    if raw_gender:
        g = raw_gender.lower().strip()
        if g in ["feminine", "female", "woman"]:
            return "female"
        if g in ["masculine", "male", "man"]:
            return "male"
    if description:
        d = description.lower()
        if "female" in d or "woman" in d:
            return "female"
        if " male " in d or " man " in d:
            return "male"
    return raw_gender or "unknown"


async def sync_cartesia_voices(db: Session):
    voices = await CartesiaService.get_voices()

    imported = 0
    updated = 0

    for voice in voices:
        clean_gender = normalize_gender(voice.get("gender"), voice.get("description"))

        existing = (
            db.query(Voice)
            .filter(
                Voice.provider_voice_id == voice["id"]
            )
            .first()
        )

        if existing:
            existing.name = voice["name"]
            existing.description = voice.get("description")
            existing.gender = clean_gender
            existing.language = voice.get("language")
            existing.is_public = voice.get("is_public", True)
            existing.is_active = True

            updated += 1

        else:
            db.add(
                Voice(
                    provider="cartesia",
                    provider_voice_id=voice["id"],
                    name=voice["name"],
                    description=voice.get("description"),
                    gender=clean_gender,
                    language=voice.get("language"),
                    is_public=voice.get("is_public", True),
                    is_active=True,
                )
            )

            imported += 1

    db.commit()

    return {
        "imported": imported,
        "updated": updated,
        "total": len(voices),
    }