import os
import sys
import uuid

backend_path = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_path)
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.database import SessionLocal
from app.main import app
from app.models import User, Workspace

db = SessionLocal()
workspace = Workspace(name=f"Profile smoke test {uuid.uuid4()}")
db.add(workspace)
db.flush()
user = User(
    workspace_id=workspace.id,
    email=f"profile-{uuid.uuid4()}@example.com",
    name="Profile Test",
    password_hash="not-used",
)
db.add(user)
db.commit()
user_id = user.id
email = user.email
token = create_access_token(
    {"user_id": str(user.id), "workspace_id": str(workspace.id)}
)
db.close()

client = TestClient(app)
headers = {"Authorization": f"Bearer {token}"}

profile_response = client.get("/auth/me", headers=headers)
assert profile_response.status_code == 200, profile_response.status_code
assert profile_response.json()["name"] == "Profile Test"

update_response = client.patch(
    "/auth/me",
    headers=headers,
    json={
        "name": "Updated Profile",
        "email": email,
        "profile_picture": "data:image/png;base64,aW1hZ2U=",
    },
)
assert update_response.status_code == 200, update_response.status_code
assert update_response.json()["name"] == "Updated Profile"

delete_response = client.delete("/auth/me", headers=headers)
assert delete_response.status_code == 200, delete_response.status_code

expired_profile_response = client.get("/auth/me", headers=headers)
assert expired_profile_response.status_code == 401

db = SessionLocal()
assert db.get(User, user_id) is None
db.close()
print("Profile GET/PATCH/DELETE routes passed against the configured database.")
