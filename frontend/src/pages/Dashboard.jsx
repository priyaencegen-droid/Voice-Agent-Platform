import { useEffect, useState } from "react";
import { AudioLines, Bot, CalendarDays, PhoneCall } from "lucide-react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalCalls: 0,
    todayCalls: 0,
  });
  const [recentCalls, setRecentCalls] = useState([]);
  const [peakTime, setPeakTime] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [agentsRes, callsRes] = await Promise.all([
          API.get("/agents"),
          API.get("/calls"),
        ]);
        const agents = agentsRes.data;
        const calls = callsRes.data;

        const today = new Date().toDateString();
        const todayCalls = calls.filter(
          (call) =>
            call.start_time &&
            new Date(call.start_time).toDateString() === today,
        ).length;

        const recent = [...calls]
          .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
          .slice(0, 5)
          .map((call) => {
            const agent = agents.find((item) => item.id === call.agent_id);
            return {
              id: call.id,
              agent: agent?.name || "Unknown agent",
              status: call.status || "unknown",
              phone: call.phone_number || "Phone call",
              startTime: call.start_time,
            };
          });

        const usageMap = {};
        calls.forEach((call) => {
          usageMap[call.agent_id] = (usageMap[call.agent_id] || 0) + 1;
        });

        const top = Object.entries(usageMap)
          .map(([agentId, count]) => {
            const agent = agents.find((item) => item.id === agentId);
            return {
              id: agentId,
              name: agent?.name || "Unknown agent",
              usage: count,
            };
          })
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 4);

        const hourMap = {};
        calls.forEach((call) => {
          if (!call.start_time) return;
          const hour = new Date(call.start_time).getHours();
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        });

        const peak = Object.entries(hourMap)
          .map(([hour, count]) => ({
            hour: Number(hour),
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);

        setStats({
          totalAgents: agents.length,
          totalCalls: calls.length,
          todayCalls,
        });
        setRecentCalls(recent);
        setTopAgents(top);
        setPeakTime(peak);
      } catch (requestError) {
        console.error("Failed to load dashboard:", requestError);
        setError("We couldn’t load your dashboard data. Please refresh to try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const maxAgentUsage = Math.max(...topAgents.map((agent) => agent.usage), 1);
  const maxPeakCount = Math.max(...peakTime.map((item) => item.count), 1);

  return (
    <div className="dashboard-page">
      <header className="dashboard-intro">
        <div>
          <h2>Good to see you</h2>
          <p>Here’s what’s happening across your voice workspace.</p>
        </div>
        <span className="dashboard-date">
          <CalendarDays size={14} aria-hidden="true" />
          {new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </span>
      </header>

      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-stat-grid" aria-label="Workspace overview">
        <StatCard
          title="Total agents"
          value={stats.totalAgents}
          caption="Voice assistants in your workspace"
          icon={Bot}
        />
        <StatCard
          title="Total calls"
          value={stats.totalCalls}
          caption="All-time conversations handled"
          icon={PhoneCall}
        />
        <StatCard
          title="Calls today"
          value={stats.todayCalls}
          caption="Conversations started today"
          icon={AudioLines}
        />
      </section>

      {loading ? (
        <div className="empty-state" aria-live="polite">
          Loading your workspace…
        </div>
      ) : (
        <section className="dashboard-panels" aria-label="Workspace activity">
          <DashboardPanel
            title="Recent calls"
            description="The latest conversations from your agents"
            action="View calls"
            onAction={() => navigate("/calls")}
          >
            {recentCalls.length === 0 ? (
              <EmptyMessage>No calls yet. Your call activity will appear here.</EmptyMessage>
            ) : (
              <div className="dashboard-list">
                {recentCalls.map((call) => (
                  <div className="dashboard-row" key={call.id}>
                    <div className="dashboard-row-main">
                      <span className="dashboard-row-icon">
                        <PhoneCall size={14} aria-hidden="true" />
                      </span>
                      <div className="dashboard-row-copy">
                        <strong>{call.agent}</strong>
                        <span>
                          {call.phone}
                          {call.startTime
                            ? ` · ${new Date(call.startTime).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </span>
                      </div>
                    </div>
                    <span className={`dashboard-status ${call.status.toLowerCase()}`}>
                      {call.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Most used agents"
            description="Agents handling the most conversations"
            action="View agents"
            onAction={() => navigate("/agents")}
          >
            {topAgents.length === 0 ? (
              <EmptyMessage>Call activity will help you spot your most-used agents.</EmptyMessage>
            ) : (
              <div className="dashboard-bars">
                {topAgents.map((agent) => (
                  <BarRow
                    key={agent.id}
                    label={agent.name}
                    value={agent.usage}
                    percentage={(agent.usage / maxAgentUsage) * 100}
                  />
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Peak call times"
            description="Hours with the most call activity"
            action="Explore analytics"
            onAction={() => navigate("/analytics")}
          >
            {peakTime.length === 0 ? (
              <EmptyMessage>Call timing insights will appear when calls are available.</EmptyMessage>
            ) : (
              <div className="dashboard-bars">
                {peakTime.map((item) => (
                  <BarRow
                    key={item.hour}
                    label={new Date(2000, 0, 1, item.hour).toLocaleTimeString(undefined, {
                      hour: "numeric",
                    })}
                    value={item.count}
                    percentage={(item.count / maxPeakCount) * 100}
                  />
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Quick start"
            description="Keep building your voice experience"
            action="Test a voice"
            onAction={() => navigate("/voice-test")}
          >
            <div className="dashboard-quick-start">
              <span className="dashboard-quick-icon">
                <AudioLines size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>Try a live conversation</strong>
                <p>Select an agent and talk to it in real time.</p>
              </div>
            </div>
          </DashboardPanel>
        </section>
      )}
    </div>
  );
}

function StatCard({ title, value, caption, icon: Icon }) {
  return (
    <article className="dashboard-stat">
      <div className="dashboard-stat-top">
        <span className="dashboard-stat-label">{title}</span>
        <span className="dashboard-stat-icon">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <strong className="dashboard-stat-value">{value}</strong>
      <p className="dashboard-stat-caption">{caption}</p>
    </article>
  );
}

function DashboardPanel({ title, description, action, onAction, children }) {
  return (
    <article className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button type="button" onClick={onAction}>
          {action} <span aria-hidden="true">→</span>
        </button>
      </div>
      {children}
    </article>
  );
}

function BarRow({ label, value, percentage }) {
  return (
    <div className="dashboard-bar-row">
      <div className="dashboard-bar-labels">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="dashboard-bar-track" aria-hidden="true">
        <div className="dashboard-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function EmptyMessage({ children }) {
  return <div className="dashboard-empty">{children}</div>;
}
