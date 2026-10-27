import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";

const titles = {
  "/": "Dashboard",
  "/agents": "Agents",
  "/calls": "Calls",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/voice-test": "Voice testing",
};

export default function TopBar() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    profile_picture: null,
  });

  const location = useLocation();
  const navigate = useNavigate();
  const title = titles[location.pathname] || "Dashboard";

  useEffect(() => {
    const updateProfile = (data = {}) => {
      setProfile({
        name: data.name ?? "",
        email: data.email ?? "",
        profile_picture: data.profile_picture ?? null,
      });
    };

    const fetchProfile = async () => {
      try {
        const res = await API.get("/auth/me");
        updateProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };

    const handleProfileUpdated = (event) => {
      if (event.detail) updateProfile(event.detail);
    };

    fetchProfile();
    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header className="app-topbar">
      <div className="topbar-heading">
        <span className="topbar-eyebrow">VOICE AI WORKSPACE</span>
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-label={`Open profile settings${profile.name ? ` for ${profile.name}` : ""}`}
          className="profile-button"
        >
          {profile.profile_picture ? (
            <img src={profile.profile_picture} alt="" className="profile-avatar" />
          ) : (
            <span aria-hidden="true" className="profile-avatar profile-avatar-fallback">
              {profile.name.trim()
                ? profile.name.trim().charAt(0).toUpperCase()
                : "U"}
            </span>
          )}
          <span className="profile-copy">
            <strong>{profile.name || "Your account"}</strong>
            <span>{profile.email || "Manage profile"}</span>
          </span>
        </button>
        <span className="topbar-divider" aria-hidden="true" />
        <button type="button" onClick={handleLogout} className="logout-button">
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
