from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.voice import Voice


def get_all_voices(db: Session, search: str | None = None, gender: str | None = None):
    query = (
        db.query(Voice)
        .filter(
            Voice.is_active == True,
            Voice.is_public == True,
            Voice.language == "en",
        )
    )

    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Voice.name).ilike(search_term),
                func.lower(Voice.description).ilike(search_term),
            )
        )

    if gender and gender.lower() != "all":
        g = gender.lower().strip()
        if g in ["female", "feminine"]:
            query = query.filter(
                or_(
                    func.lower(Voice.gender) == "female",
                    func.lower(Voice.gender) == "feminine",
                    Voice.description.ilike("%female%"),
                    Voice.description.ilike("%woman%"),
                )
            )
        elif g in ["male", "masculine"]:
            query = query.filter(
                or_(
                    func.lower(Voice.gender) == "male",
                    func.lower(Voice.gender) == "masculine",
                    Voice.description.ilike("% male %"),
                    Voice.description.ilike("% man %"),
                )
            )
        else:
            query = query.filter(func.lower(Voice.gender) == g)

    return query.order_by(Voice.name).all()