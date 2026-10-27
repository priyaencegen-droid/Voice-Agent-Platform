import base64
import binascii
import re

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    workspace_name: str = Field(..., min_length=1, strip_whitespace=True)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str):
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one number")

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise ValueError("Password must contain at least one special character")

        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    profile_picture: str | None = Field(default=None, max_length=1_400_000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        return value

    @field_validator("profile_picture")
    @classmethod
    def validate_profile_picture(cls, value: str | None):
        if value is None:
            return value

        match = re.fullmatch(
            r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})",
            value,
        )
        if not match:
            raise ValueError("Profile picture must be a PNG, JPEG, or WebP image")

        try:
            image = base64.b64decode(match.group(2), validate=True)
        except binascii.Error as exc:
            raise ValueError("Profile picture is not valid base64 data") from exc

        if not image or len(image) > 1_048_576:
            raise ValueError("Profile picture must be 1 MB or smaller")

        return value


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"