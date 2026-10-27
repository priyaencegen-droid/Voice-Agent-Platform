import base64
import io
import json
import httpx
import os
import uuid
import wave
import websockets

from app.core.config import settings


class CartesiaService:
    BASE_URL = "https://api.cartesia.ai"
    TTS_WEBSOCKET_URL = "wss://api.cartesia.ai/tts/websocket"

    @classmethod
    async def get_voices(cls):
        headers = {
            "X-API-Key": os.getenv("CARTESIA_API_KEY"),
            "Cartesia-Version": "2024-06-10",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{cls.BASE_URL}/voices",
                headers=headers,
            )

        response.raise_for_status()

        voices = response.json()

        return [
            {
                "id": voice["id"],
                "name": voice["name"],
                "description": voice.get("description"),
                "gender": voice.get("gender"),
                "language": voice.get("language"),
                "is_public": voice.get("is_public"),
            }
            for voice in voices
        ]

    @classmethod
    async def synthesize_preview(
        cls,
        voice_id: str,
        text: str,
        voice_speed: float = 1.0,
    ) -> bytes:
        api_key = os.getenv("CARTESIA_API_KEY")
        if not api_key:
            raise RuntimeError("CARTESIA_API_KEY is not configured")

        if voice_speed <= 0.6:
            speed = "slowest"
        elif voice_speed <= 0.85:
            speed = "slow"
        elif voice_speed <= 1.15:
            speed = "normal"
        elif voice_speed <= 1.5:
            speed = "fast"
        else:
            speed = "fastest"

        request_payload = {
            "model_id": "sonic-2",
            "transcript": text,
            "voice": {
                "mode": "id",
                "id": voice_id,
                "__experimental_controls": {"speed": speed},
            },
            "language": "en",
            "context_id": str(uuid.uuid4()),
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": 8000,
            },
            "continue": False,
        }
        pcm_chunks = []
        headers = {
            "X-API-Key": api_key,
            "Cartesia-Version": "2024-06-10",
        }

        try:
            async with websockets.connect(
                cls.TTS_WEBSOCKET_URL,
                additional_headers=headers,
                open_timeout=20,
                close_timeout=5,
            ) as websocket:
                await websocket.send(json.dumps(request_payload))

                while True:
                    message = json.loads(await websocket.recv())
                    message_type = message.get("type")

                    if message_type == "chunk":
                        audio_data = message.get("data")
                        if audio_data:
                            pcm_chunks.append(base64.b64decode(audio_data))
                        if message.get("done", False):
                            break
                    elif message_type == "done":
                        break
                    elif message_type == "error":
                        raise RuntimeError(
                            f"Cartesia error {message.get('status_code')}: "
                            f"{message.get('message', message)}"
                        )
        except Exception as exc:
            raise RuntimeError(f"Cartesia preview synthesis failed: {exc}") from exc

        pcm_audio = b"".join(pcm_chunks)
        if not pcm_audio:
            raise RuntimeError("Cartesia returned no preview audio")

        wav_audio = io.BytesIO()
        with wave.open(wav_audio, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(8000)
            wav_file.writeframes(pcm_audio)

        return wav_audio.getvalue()