import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";

export default function VoiceTest() {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [transcripts, setTranscripts] = useState([]);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const lastUserTextRef = useRef("");

  // Track the unique chunks we've already rendered to prevent text duplication
  const processedTextChunksRef = useRef(new Set());

  // 1. Fetch available agents on load
  useEffect(() => {
    API.get("/agents")
      .then((res) => {
        setAgents(res.data);
        if (res.data.length > 0) setSelectedAgentId(res.data[0].id);
      })
      .catch((err) => console.error("Failed to load agents:", err));

    return () => stopSession();
  }, []);

  // 2. Initialize Audio Context for Input & Output cleanly
  const initAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
          latencyHint: "interactive",
        });
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      nextPlayTimeRef.current = audioContextRef.current.currentTime;

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      });

      if (!audioContextRef.current) {
        throw new Error("AudioContext was closed during device handshakes.");
      }

      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        
        wsRef.current.send(pcm16Buffer.buffer);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      console.log("[FRONTEND] Audio input pipeline successfully linked.");
    } catch (audioErr) {
      console.error("Failed to initialize hardware audio devices:", audioErr);
      throw audioErr;
    }
  };

  // 3. Play Incoming Base64 Chunks Consecutively
  const playAudioChunk = async (base64Payload) => {
    try {
      if (!audioContextRef.current) return;

      const binaryString = window.atob(base64Payload);
      const validLength = binaryString.length - (binaryString.length % 2);
      if (validLength === 0) return;

      const bytes = new Uint8Array(validLength);
      for (let i = 0; i < validLength; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Keep this at 8000 exactly since it preserves your perfect playback speed!
      const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 8000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      const startTime = Math.max(nextPlayTimeRef.current, audioContextRef.current.currentTime);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (err) {
      console.error("Error decoding or playing audio stream chunk:", err);
    }
  };

  // 4. Start Session & Connect
  const startSession = async () => {
    if (!selectedAgentId) return alert("Please select an agent first.");
    
    try {
      setStatus("Initializing microphone & audio...");
      await initAudio();

      setStatus("Requesting session...");
      const res = await API.post("/api/voice-test/session", { agent_id: selectedAgentId });
      const token = res.data.token;

      setStatus("Connecting to WebSocket...");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//localhost:8000/api/voice-test/ws?token=${token}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setStatus("Live - Speak into Microphone");
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "audio") {
          playAudioChunk(data.payload);
        } 
        // 🌟 GLOBAL FIX: Stop user STT duplicates even if the AI has started speaking
        else if (data.type === "user_transcript") {
          const userText = data.text ? data.text.trim() : "";
          if (!userText) return;

          // If this exact sentence matches what you just said, block it globally
          if (lastUserTextRef.current === userText) {
            return;
          }
          lastUserTextRef.current = userText; // Update the global memory

          setTranscripts((prev) => [
            ...prev,
            { sender: "user", text: userText }
          ]);
        }
        else if (data.type === "text_delta") {
          const textChunk = data.text ? data.text.trim() : "";
          if (!textChunk) return;

          if (processedTextChunksRef.current.has(textChunk)) return;
          processedTextChunksRef.current.add(textChunk);

          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === "ai") {
              const updated = [...prev];
              if (!updated[updated.length - 1].text.includes(textChunk)) {
                updated[updated.length - 1].text += " " + textChunk;
              }
              return updated;
            }
            return [...prev, { sender: "ai", text: textChunk }];
          });
        } 
        else if (data.type === "clear") {
          processedTextChunksRef.current.clear();
        }
      };

      wsRef.current.onclose = () => stopSession();
      wsRef.current.onerror = (e) => console.error("WebSocket Error:", e);

    } catch (err) {
      console.error("Session initialization failed:", err);
      setStatus("Failed to connect.");
      stopSession();
    }
  };

  const stopSession = () => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setStatus("Disconnected");
    processedTextChunksRef.current.clear();

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach((track) => track.stop()); } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close();
        }
      } catch (e) {}
      audioContextRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  };

  const handleClearTranscript = () => {
    setTranscripts([]);
    processedTextChunksRef.current.clear();
  };

  return (
    <div className="voice-test-card max-w-3xl mx-auto p-6 sm:p-8">
      <header className="page-heading">
        <div>
          <h2>Voice testing</h2>
          <p>Talk to an agent in real time and review the conversation transcript.</p>
        </div>
      </header>
      
      <div className="voice-control-row mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Choose an agent</label>
          <select
            disabled={isConnected}
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-gray-50 focus:outline-none"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>

        {!isConnected ? (
          <button onClick={startSession} className="voice-start-button">
            Start live conversation
          </button>
        ) : (
          <button onClick={stopSession} className="voice-end-button">
            End conversation
          </button>
        )}
      </div>

      {(() => {
        const currentAgent = agents.find((a) => a.id === selectedAgentId);
        if (!currentAgent) return null;
        return (
          <div className="voice-agent-meta mb-5 grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
            <div>
              <span className="text-gray-400 block font-medium">Selected Voice</span>
              <span className="font-semibold text-gray-800 truncate block mt-0.5" title={currentAgent.voice}>
                🎙️ {currentAgent.voice ? currentAgent.voice.slice(0, 14) + "..." : "Default Voice"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Voice Speed (TTS)</span>
              <span className="font-semibold text-blue-600 block mt-0.5">
                ⚡ {Number(currentAgent.voice_speed ?? 1.0).toFixed(1)}x speed
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">LLM Temperature</span>
              <span className="font-semibold text-amber-600 block mt-0.5">
                🎛️ {Number(currentAgent.temperature ?? 0.7).toFixed(2)}
              </span>
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <span className={`text-sm font-bold ${isConnected ? "text-green-600" : "text-gray-500"}`}>{status}</span>
        </div>
        
        <button 
          onClick={handleClearTranscript}
          className="voice-clear-button"
        >
          Clear Transcript
        </button>
      </div>

      <div className="voice-transcript border rounded-lg p-4 bg-gray-50 h-64 overflow-y-auto flex flex-col gap-2">
        {transcripts.length === 0 && <p className="text-gray-400 text-sm text-center my-auto">Your conversation transcript will appear here.</p>}
        {transcripts.map((t, idx) => (
          <div key={idx} className={`p-2 rounded max-w-[85%] text-sm ${t.sender === "ai" ? "bg-blue-100 text-blue-900 self-start" : "bg-green-100 text-green-900 self-end"}`}>
            <strong>{t.sender === "ai" ? "Agent: " : "You: "}</strong>{t.text}
          </div>
        ))}
      </div>
    </div>
  );
}