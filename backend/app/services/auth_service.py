from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from sqlalchemy import func
from app.models import User, Workspace
from app.models.agent import Agent
from app.models.api_key import APIKey
from app.models.call import Call
from app.models.knowledge_base import KnowledgeBase
from app.models.phone_number import PhoneNumber
from app.models.usage_record import UsageRecord
from app.core.security import hash_password, verify_password


def register_user(db: Session, email: str, password: str, workspace_name: str):
    # Check if user exists
    existing = db.query(User).filter(
        func.lower(User.email) == email.strip().lower()
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists."
        )

    try:
        # Create workspace
        workspace = Workspace(name=workspace_name)
        db.add(workspace)
        db.flush()

        # Create user
        user = User(
            email=email.strip().lower(),
            password_hash=hash_password(password),
            workspace_id=workspace.id,
            role="owner"
        )
        db.add(user)
        db.commit()

        return user

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Registration failed")


def login_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email.strip().lower()).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return user


def update_user_profile(
    db: Session,
    user: User,
    name: str,
    email: str,
    profile_picture: str | None,
):
    normalized_email = email.strip().lower()
    existing_user = db.query(User).filter(
        func.lower(User.email) == normalized_email,
        User.id != user.id,
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user.name = name.strip()
    user.email = normalized_email
    user.profile_picture = profile_picture

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        ) from exc

    db.refresh(user)
    return user


def delete_user_account(db: Session, user: User):
    workspace_has_other_users = db.query(User.id).filter(
        User.workspace_id == user.workspace_id,
        User.id != user.id,
    ).first() is not None

    if not workspace_has_other_users:
        workspace_id = user.workspace_id
        db.query(Call).filter(Call.workspace_id == workspace_id).delete(
            synchronize_session=False
        )
        db.query(PhoneNumber).filter(
            PhoneNumber.workspace_id == workspace_id
        ).delete(synchronize_session=False)
        db.query(KnowledgeBase).filter(
            KnowledgeBase.workspace_id == workspace_id
        ).delete(synchronize_session=False)
        db.query(APIKey).filter(APIKey.workspace_id == workspace_id).delete(
            synchronize_session=False
        )
        db.query(UsageRecord).filter(
            UsageRecord.workspace_id == workspace_id
        ).delete(synchronize_session=False)
        db.query(Agent).filter(Agent.workspace_id == workspace_id).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.workspace_id == workspace_id).delete(
            synchronize_session=False
        )
        db.query(Workspace).filter(Workspace.id == workspace_id).delete(
            synchronize_session=False
        )
    else:
        db.query(User).filter(User.id == user.id).delete(
            synchronize_session=False
        )

    db.commit()