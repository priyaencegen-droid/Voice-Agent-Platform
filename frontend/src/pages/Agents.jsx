import { useEffect, useRef, useState } from "react";
import API from "../services/api";
import { getVoicePreview, getVoices } from "../services/voice";
const DEFAULT_PREVIEW_TEXT = "Hello! I’m your voice assistant. How can I help you today?";

const EMPTY_FORM = {
  id: "",
  name: "",
  system_prompt: "",
  voice: "",
  language: "en",
  llm_model: "openai/gpt-oss-20b",
  temperature: 0.7,
  voice_speed: 1.0,
};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [knowledgeBaseFile, setKnowledgeBaseFile] = useState(null);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const previewRequestIdRef = useRef(0);
  const previewAbortRef = useRef(null);
  const previewAudioRef = useRef(null);
  const previewUrlRef = useRef(null);

  useEffect(() => {
    fetchAgents();
    fetchVoices();
  }, []);

  useEffect(() => () => {
    previewRequestIdRef.current += 1;
    previewAbortRef.current?.abort();
    previewAudioRef.current?.pause();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await API.get("/agents");
      setAgents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchVoices = async (search = voiceSearch, gender = genderFilter) => {
    try {
      setVoicesLoading(true);
      const params = {};
      if (search && search.trim()) params.search = search.trim();
      if (gender && gender !== "all") params.gender = gender;

      const data = await getVoices(params);
      setVoices(data);
    } catch (err) {
      console.error("Failed to load voices:", err);
    } finally {
      setVoicesLoading(false);
    }
  };
  const validateForm = () => {
    if (!form.name.trim()) return "Agent name is required";
    if (!form.system_prompt.trim()) return "System prompt is required";
    if (!form.voice.trim()) return "Voice is required";

    return "";
  };

  const handleCreate = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        system_prompt: form.system_prompt.trim(),
        voice: form.voice,
        language: "en",
        llm_model: "openai/gpt-oss-20b",
        temperature: form.temperature !== undefined && form.temperature !== null ? parseFloat(form.temperature) : 0.7,
        voice_speed: form.voice_speed !== undefined && form.voice_speed !== null ? parseFloat(form.voice_speed) : 1.0,
      };

      const res = await API.post("/agents", payload);

      if (knowledgeBaseFile) {
        const formData = new FormData();

        formData.append("file", knowledgeBaseFile);
        formData.append("agent_id", res.data.id);

        await API.post(
          "/knowledge-base",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      setAgents((prev) => [...prev, res.data]);

      resetModal();

    } catch {
      setError("Failed to create agent");
    }
  };

  const handleUpdate = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        system_prompt: form.system_prompt.trim(),
        voice: form.voice,
        language: form.language || "en",
        llm_model: form.llm_model || "openai/gpt-oss-20b",
        temperature: form.temperature !== undefined && form.temperature !== null ? parseFloat(form.temperature) : 0.7,
        voice_speed: form.voice_speed !== undefined && form.voice_speed !== null ? parseFloat(form.voice_speed) : 1.0,
      };
      const res = await API.put(`/agents/${form.id}`, payload);
      setAgents((prev) =>
        prev.map((a) => (a.id === form.id ? res.data : a))
      );
      resetModal();
    } catch {
      setError("Failed to update agent");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await API.delete(`/agents/${deleteTarget}`);
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget));
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete agent");
    }
  };

  const handleEdit = (agent) => {
    setForm({
      ...agent,
      temperature: agent.temperature !== undefined && agent.temperature !== null ? parseFloat(agent.temperature) : 0.7,
      voice_speed: agent.voice_speed !== undefined && agent.voice_speed !== null ? parseFloat(agent.voice_speed) : 1.0,
    });
    setEditing(true);
    setShowModal(true);
  };

  const resetModal = () => {
    stopVoicePreview();
    setShowModal(false);
    setEditing(false);
    setKnowledgeBaseFile(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const stopVoicePreview = () => {
    previewRequestIdRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewingVoiceId(null);
  };

  const handleVoicePreview = async (voice) => {
    stopVoicePreview();
    setPreviewError("");
    if (!previewText.trim()) {
      setPreviewError("Enter some text to preview this voice.");
      return;
    }

    const requestId = previewRequestIdRef.current;
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreviewingVoiceId(voice.provider_voice_id);

    try {
      const audioBlob = await getVoicePreview({
        voiceId: voice.provider_voice_id,
        text: previewText.trim(),
        voiceSpeed: Number(form.voice_speed ?? 1.0),
        signal: controller.signal,
      });
      if (requestId !== previewRequestIdRef.current) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      previewUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;

      const releaseAudio = () => {
        if (requestId !== previewRequestIdRef.current) return;
        previewAudioRef.current = null;
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setPreviewingVoiceId(null);
      };
      audio.addEventListener("ended", releaseAudio, { once: true });
      audio.addEventListener("error", () => {
        releaseAudio();
        setPreviewError("Audio playback failed. Please try again.");
      }, { once: true });
      await audio.play();
    } catch (err) {
      if (requestId !== previewRequestIdRef.current) return;
      if (err.name !== "AbortError" && err.code !== "ERR_CANCELED") {
        setPreviewError(
          err.response?.data?.detail ||
            "Could not play this voice preview. Please try again."
        );
      }
      stopVoicePreview();
    }
  };
  const resolveVoiceGender = (voice) => {
    if (!voice) return "Unknown";
    const g = (voice.gender || "").toLowerCase().trim();
    const desc = (voice.description || "").toLowerCase();
    const name = (voice.name || "").toLowerCase();

    if (g === "female" || g === "feminine" || g === "woman" || g === "f") return "Female";
    if (g === "male" || g === "masculine" || g === "man" || g === "m") return "Male";

    if (/\b(female|woman|girl|feminine|lady)\b/i.test(desc) || /\b(female|woman|girl|lady)\b/i.test(name)) {
      return "Female";
    }
    if (/\b(male|man|guy|masculine|gentleman|boy)\b/i.test(desc) || /\b(male|man|guy|boy)\b/i.test(name)) {
      return "Male";
    }

    if (g) return g.charAt(0).toUpperCase() + g.slice(1);
    return "Unknown";
  };

  const filteredVoices = voices.filter((voice) => {
    const search = voiceSearch.toLowerCase().trim();
    const detectedGender = resolveVoiceGender(voice).toLowerCase();
    const matchesSearch =
      !search ||
      voice.name.toLowerCase().includes(search) ||
      (voice.description || "").toLowerCase().includes(search);
    const matchesGender =
      genderFilter === "all" ||
      (genderFilter === "female" && detectedGender === "female") ||
      (genderFilter === "male" && detectedGender === "male");

    return matchesSearch && matchesGender;
  });

  const selectedVoice = voices.find(
    (voice) => voice.provider_voice_id === form.voice
  );

  return (
    <div className="agents-page">

      {/* HEADER */}
      <div className="page-heading">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Agents
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your voice agents and configurations
          </p>
        </div>

        <button
          id="new-agent-btn"
          onClick={() => setShowModal(true)}
          className="primary-action"
        >
          + Create agent
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="empty-state" aria-live="polite">Loading your agents…</div>
      ) : agents.length === 0 ? (
        <div className="empty-state">
          <strong>No agents yet</strong>
          Create your first voice agent to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {agents.map((agent) => {
            const voiceName =
              voices.find((v) => v.provider_voice_id === agent.voice)?.name ||
              agent.voice;

            return (
              <div
                key={agent.id}
                onClick={() =>
                  setSelectedAgent(
                    selectedAgent?.id === agent.id ? null : agent
                  )
                }
                className="agent-card bg-white border rounded-2xl p-5 hover:shadow-lg transition cursor-pointer flex flex-col justify-between"
              >

                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {agent.name}
                  </h2>

                  <p className="text-xs text-gray-400 mt-1">
                    {agent.llm_model}
                  </p>

                  {/* SCROLLABLE PROMPT */}
                  <div className="mt-3 bg-gray-50 border rounded-lg p-3 text-sm text-gray-600 max-h-24 overflow-y-auto">
                    {agent.system_prompt || "No prompt set"}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-gray-600 gap-2 flex-wrap">
                    <p className="truncate max-w-[150px]">
                      <span className="text-gray-400">Voice:</span>{" "}
                      <span className="font-medium text-gray-800">{voiceName || "—"}</span>
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {agent.voice_speed !== undefined && agent.voice_speed !== null ? `${Number(agent.voice_speed).toFixed(1)}x` : "1.0x"} speed
                      </span>
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Temp {agent.temperature !== undefined && agent.temperature !== null ? Number(agent.temperature).toFixed(1) : "0.7"}
                      </span>
                    </div>
                  </div>

                  {selectedAgent?.id === agent.id && (
                    <div className="mt-2 text-xs text-gray-400 break-all">
                      {agent.id}
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-4 pt-3 border-t">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(agent);
                    }}
                    className="text-blue-600 text-sm"
                  >
                    Edit
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(agent.id);
                    }}
                    className="text-red-500 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="agent-modal-backdrop fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editing ? "Edit Agent" : "Create Agent"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Configure your agent and choose a voice with a polished, focused experience.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Agent Details</h3>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Agent Name
                    </label>
                    <input
                      id="agent-name-input"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500"
                      placeholder="Name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      System Prompt
                    </label>
                    <textarea
                      id="system-prompt-input"
                      rows={10}
                      className="min-h-[250px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500"
                      placeholder="System Prompt"
                      value={form.system_prompt}
                      onChange={(e) =>
                        setForm({ ...form, system_prompt: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Knowledge Base
                    </label>
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Upload File
                        <input
                          type="file"
                          accept=".pdf,.txt"
                          className="hidden"
                          onChange={(e) =>
                            setKnowledgeBaseFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>

                      <p className="mt-3 text-sm text-gray-600">
                        {knowledgeBaseFile ? knowledgeBaseFile.name : "No file selected"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Language
                        </label>
                        <input
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
                          value="English"
                          disabled
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Model
                        </label>
                        <input
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
                          value="model"
                          disabled
                        />
                      </div>
                    </div>

                    {/* Model Temperature Slider (0.0 to 1.5) */}
                    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">🎛️</span>
                            <label className="text-sm font-semibold text-gray-900">
                              LLM Temperature
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Controls response creativity vs deterministic consistency (0.0 to 1.5)
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
                          {Number(form.temperature ?? 0.7).toFixed(2)}
                        </span>
                      </div>

                      {/* Status indicator */}
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium">
                        {Number(form.temperature ?? 0.7) <= 0.3 && (
                          <span className="text-indigo-600 font-semibold">🎯 Precise & Deterministic (Factual Q&A)</span>
                        )}
                        {Number(form.temperature ?? 0.7) > 0.3 && Number(form.temperature ?? 0.7) <= 0.8 && (
                          <span className="text-emerald-600 font-semibold">⚖️ Balanced & Conversational (Optimal Voice)</span>
                        )}
                        {Number(form.temperature ?? 0.7) > 0.8 && (
                          <span className="text-amber-600 font-semibold">✨ Creative & Spontaneous (Expressive)</span>
                        )}
                      </div>

                      {/* Range slider */}
                      <input
                        id="llm-temperature-slider"
                        type="range"
                        min="0.0"
                        max="1.5"
                        step="0.05"
                        value={form.temperature ?? 0.7}
                        onChange={(e) =>
                          setForm({ ...form, temperature: parseFloat(e.target.value) })
                        }
                        className="mt-3 w-full cursor-pointer accent-amber-600"
                      />

                      {/* Quick Presets */}
                      <div className="mt-3 flex gap-2">
                        {[
                          { label: "Precise (0.2)", value: 0.2 },
                          { label: "Balanced (0.7)", value: 0.7 },
                          { label: "Creative (1.0)", value: 1.0 },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setForm({ ...form, temperature: preset.value })}
                            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                              Math.abs((form.temperature ?? 0.7) - preset.value) < 0.04
                                ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Voice & Speech Settings</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configure speech pacing and select voice persona
                    </p>
                  </div>

                  {/* Voice Speed Slider (0.5x to 2.0x) */}
                  <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/20 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🎙️</span>
                          <label className="text-sm font-semibold text-gray-900">
                            Voice Speed (TTS Rate)
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Controls pacing and speaking rate of the voice (0.5x to 2.0x)
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-800">
                        {Number(form.voice_speed ?? 1.0).toFixed(1)}x
                      </span>
                    </div>

                    {/* Status indicator */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium">
                      {Number(form.voice_speed ?? 1.0) <= 0.6 && (
                        <span className="text-blue-600 font-semibold">🐢 Slowest (Very Deliberate)</span>
                      )}
                      {Number(form.voice_speed ?? 1.0) > 0.6 && Number(form.voice_speed ?? 1.0) <= 0.85 && (
                        <span className="text-teal-600 font-semibold">🌿 Slow & Relaxed</span>
                      )}
                      {Number(form.voice_speed ?? 1.0) > 0.85 && Number(form.voice_speed ?? 1.0) <= 1.15 && (
                        <span className="text-emerald-600 font-semibold">🎙️ Natural / Normal Speed</span>
                      )}
                      {Number(form.voice_speed ?? 1.0) > 1.15 && Number(form.voice_speed ?? 1.0) <= 1.5 && (
                        <span className="text-amber-600 font-semibold">⚡ Fast & Energetic</span>
                      )}
                      {Number(form.voice_speed ?? 1.0) > 1.5 && (
                        <span className="text-purple-600 font-semibold">🚀 Fastest Pace</span>
                      )}
                    </div>

                    {/* Range slider */}
                    <input
                      id="voice-speed-slider"
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={form.voice_speed ?? 1.0}
                      onChange={(e) =>
                        setForm({ ...form, voice_speed: parseFloat(e.target.value) })
                      }
                      className="mt-3 w-full cursor-pointer accent-blue-600"
                    />

                    {/* Quick Presets */}
                    <div className="mt-3 flex gap-2">
                      {[
                        { label: "Slow (0.8x)", value: 0.8 },
                        { label: "Normal (1.0x)", value: 1.0 },
                        { label: "Fast (1.3x)", value: 1.3 },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setForm({ ...form, voice_speed: preset.value })}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                            Math.abs((form.voice_speed ?? 1.0) - preset.value) < 0.05
                              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        fetchVoices(voiceSearch, genderFilter);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500"
                        placeholder="Search voices..."
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={voicesLoading}
                        className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition"
                      >
                        Search
                      </button>
                    </form>

                    <div className="mt-3 flex gap-2">
                      {[
                        { label: "All", value: "all" },
                        { label: "Female", value: "female" },
                        { label: "Male", value: "male" },
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => {
                            setGenderFilter(filter.value);
                            fetchVoices(voiceSearch, filter.value);
                          }}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${genderFilter === filter.value
                              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                    <div className="text-sm font-medium text-gray-700">Selected Voice</div>
                    {selectedVoice ? (
                      <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                            <span>🎙</span>
                            <span>{selectedVoice.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              previewingVoiceId === selectedVoice.provider_voice_id
                                ? stopVoicePreview()
                                : handleVoicePreview(selectedVoice)
                            }
                            className="shrink-0 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                          >
                            {previewingVoiceId === selectedVoice.provider_voice_id
                              ? "Stop"
                              : previewingVoiceId
                                ? "Playing another voice..."
                                : "Preview"}
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          {resolveVoiceGender(selectedVoice)} • English
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          {selectedVoice.description || "No description available"}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                        No voice selected
                      </div>
                    )}
                    <label
                      htmlFor="voice-preview-text"
                      className="mt-4 mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Preview sample
                    </label>
                    <textarea
                      id="voice-preview-text"
                      rows={2}
                      maxLength={500}
                      value={previewText}
                      onChange={(event) => setPreviewText(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                    />
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>
                        {previewingVoiceId ? "Generating or playing preview..." : "Up to 500 characters"}
                      </span>
                      <span>{previewText.length}/500</span>
                    </div>
                    {previewError && (
                      <p role="alert" className="mt-2 text-sm text-red-600">
                        {previewError}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between text-sm font-medium text-gray-700">
                      <span>Available Voices</span>
                      <span className="text-xs text-gray-400 font-normal">
                        {filteredVoices.length} voice{filteredVoices.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                      {voicesLoading ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                          Loading voices...
                        </div>
                      ) : filteredVoices.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                          No voices match your search.
                        </div>
                      ) : (
                        filteredVoices.map((voice) => (
                          <div
                            key={voice.id}
                            className={`rounded-2xl border p-4 transition ${form.voice === voice.provider_voice_id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white"
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                stopVoicePreview();
                                setForm({
                                  ...form,
                                  voice: voice.provider_voice_id,
                                });
                              }}
                              className="w-full text-left"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-gray-900">{voice.name}</div>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                  {resolveVoiceGender(voice)}
                                </span>
                              </div>
                              <div className="mt-1 text-sm text-gray-500">English</div>
                              <div className="mt-2 text-sm text-gray-600">
                                {voice.description || "No description available"}
                              </div>
                              <div className="mt-3 text-xs font-semibold text-blue-700">
                                {form.voice === voice.provider_voice_id ? "Selected" : "Select voice"}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                previewingVoiceId === voice.provider_voice_id
                                  ? stopVoicePreview()
                                  : handleVoicePreview(voice)
                              }
                              className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                            >
                              {previewingVoiceId === voice.provider_voice_id
                                ? "Stop preview"
                                : previewingVoiceId
                                  ? "Preview this voice"
                                  : "Preview"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-white px-8 py-5">
              <button
                id="cancel-agent-btn"
                type="button"
                onClick={resetModal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                id="submit-agent-btn"
                type="button"
                onClick={editing ? handleUpdate : handleCreate}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-80 shadow-lg">
            <h2 className="text-lg font-semibold mb-3">
              Delete Agent
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this agent?
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}