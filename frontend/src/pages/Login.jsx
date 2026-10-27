import { useState } from "react";
import API from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { AudioWaveform } from "lucide-react";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", form);

      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("workspace", form.email);

      navigate("/");
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Too many attempts. Please wait a minute.");
      } else if (err.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(err.response?.data?.detail ?? "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-brand">
          <span className="sidebar-brand-mark">
            <AudioWaveform size={18} aria-hidden="true" />
          </span>
          <span className="auth-brand-wordmark">voice<span>forge</span></span>
        </div>
        <h2>Welcome back</h2>
        <p className="auth-description">
          Sign in to manage your voice agents and conversations.
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="auth-fields">
          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <p className="auth-footer">
          New to Voiceforge? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}