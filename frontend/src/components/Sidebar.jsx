import {
  AudioWaveform,
  BarChart3,
  Bot,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Settings,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const menu = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Agents", path: "/agents", icon: Bot },
  { name: "Calls", path: "/calls", icon: Phone },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Voice testing", path: "/voice-test", icon: AudioWaveform },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-header">
        <Link className="sidebar-brand" to="/" aria-label="Voice AI home">
          <span className="sidebar-brand-mark">
            <AudioWaveform size={20} aria-hidden="true" />
          </span>
          {!collapsed && (
            <span className="sidebar-brand-copy">
              <strong>voice<span>forge</span></strong>
              <small>AI workspace</small>
            </span>
          )}
        </Link>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="sidebar-section-label">
        {!collapsed && <span>WORKSPACE</span>}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.name : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {!collapsed && <span>{item.name}</span>}
              {active && <span className="sidebar-active-mark" />}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <Sparkles size={16} aria-hidden="true" />
            <div>
              <strong>Your workspace</strong>
              <span>Agents, calls, and analytics</span>
            </div>
          </div>
          <div className="sidebar-version">
            <Sparkles size={14} aria-hidden="true" />
            Built for better conversations
          </div>
        </div>
      )}
    </aside>
  );
}
