# Voiceforge frontend

The frontend is a React 19 single-page application built with Vite. It provides the authenticated dashboard, agent and call management, analytics, profile settings, and browser-based voice testing.

For the full system architecture, backend setup, environment variables, and details of the LLM, STT, and TTS integrations, see the [project README](../README.md).

## Local development

Install dependencies and start the development server:

```shell
npm ci
npm run dev
```

By default, the frontend sends REST requests to `http://localhost:8000`. Set `VITE_API_URL` in the frontend environment if the FastAPI backend uses a different URL.

The browser voice-test WebSocket currently connects to `localhost:8000`, so that feature expects the backend to be available there unless the client code is configured for another host.

## Checks

```shell
npm run lint
npm run build
```
