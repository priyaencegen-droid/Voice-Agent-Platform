import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioWaveform } from "lucide-react";
import API from "../services/api";

export default function Register() {
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Backend expects: { email, password, workspace_name }
      // Password rules: min 8 chars, 1 uppercase, 1 number, 1 special char
      await API.post(
        "/auth/register",
        {
          email,
          password,
          workspace_name: workspace,
        },
        // No auth header needed — this is a public endpoint
      );

      alert("Registered successfully! Please log in.");
      navigate("/login");
    } catch (err) {
      // FastAPI returns errors as { detail: "..." }
      setError(
        err.response?.data?.detail ?? "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form onSubmit={handleRegister} className="auth-card">
        <div className="auth-brand">
          <span className="sidebar-brand-mark">
            <AudioWaveform size={18} aria-hidden="true" />
          </span>
          <span className="auth-brand-wordmark">voice<span>forge</span></span>
        </div>
        <h2>Create your workspace</h2>
        <p className="auth-description">
          Set up your account and start building better voice experiences.
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="auth-fields">
          <div className="auth-field">
            <label htmlFor="register-workspace">Workspace name</label>
            <input
              id="register-workspace"
              type="text"
              autoComplete="organization"
              placeholder="Your company"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <p className="auth-password-hint">
            At least 8 characters, including an uppercase letter, a number, and
            a special character.
          </p>
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Creating workspace..." : "Create account"}
          </button>
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
