from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, ProfileUpdate
from app.services.auth_service import (
    delete_user_account,
    login_user,
    register_user,
    update_user_profile,
)
from app.core.security import create_access_token, get_current_user
from app.models.user import User
from app.core.rate_limit import limiter
from fastapi import Request

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthResponse)
@limiter.limit("3/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(
        db,
        payload.email,
        payload.password,
        payload.workspace_name
    )

    token = create_access_token({
        "user_id": str(user.id),
        "workspace_id": str(user.workspace_id)
    })

    return {"access_token": token}


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = login_user(db, payload.email, payload.password)

    token = create_access_token({
        "user_id": str(user.id),
        "workspace_id": str(user.workspace_id)
    })

    return {
        "access_token": token
    }


@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"],
           User.workspace_id == current_user["workspace_id"]
           ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "profile_picture": user.profile_picture,
        "workspace_name": user.workspace.name if user.workspace else "User"
    }


@router.patch("/me")
def update_me(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["user_id"] is None:
        raise HTTPException(status_code=401, detail="User authentication required")

    user = db.query(User).filter(
        User.id == current_user["user_id"],
        User.workspace_id == current_user["workspace_id"],
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user = update_user_profile(
        db,
        user,
        payload.name,
        str(payload.email),
        payload.profile_picture,
    )
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "profile_picture": user.profile_picture,
        "workspace_name": user.workspace.name if user.workspace else "User",
    }


@router.delete("/me")
def delete_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["user_id"] is None:
        raise HTTPException(status_code=401, detail="User authentication required")

    user = db.query(User).filter(
        User.id == current_user["user_id"],
        User.workspace_id == current_user["workspace_id"],
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    delete_user_account(db, user)
    return {"message": "Account deleted"}