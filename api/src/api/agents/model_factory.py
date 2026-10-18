"""Fabrik model LLM — env switch dev/prod (DESIGN.md §8).

- `LITELLM_BASE_URL` terisi -> `LiteLlm` ke proxy lokal (dev, mis. Groq).
- Tidak terisi -> model Gemini native (prod, default `gemini-2.5-flash`).

Semua import ADK dilakukan **di dalam** `build_client()`, jadi mengimpor modul
ini tidak menyentuh jaringan dan tidak constructing model apa pun (zero real
API call at import time).

`StructuredLlmClient` adalah protocol kecil supaya pipeline/assess bisa diuji
dengan client palsu tanpa jaringan (lihat tests/test_ai_pipeline.py).
"""

from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

from api.agents.prompts import _SYSTEM_ID
from api.core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

APP_NAME = "lms_agents"
WORKER_AGENT_NAME = "lms_ai_worker"
WORKER_USER_ID = "lms-ai-lane"

KIND_LITELLM = "litellm"
KIND_GEMINI = "gemini"


class ModelCallError(RuntimeError):
    """Panggilan model gagal (jaringan, provider, atau output tidak valid)."""


@dataclass(frozen=True)
class InlineData:
    """Potongan file untuk fallback multimodal (`types.Part inline_data`).

    Sengaja dataclass sendiri, bukan `google.genai.types.Part`, supaya
    pipeline/extract tidak perlu mengimpor genai types (dan supaya test tidak
    pernah menyentuh SDK Google).
    """

    data: bytes
    mime_type: str


@dataclass(frozen=True)
class ModelSpec:
    """Konfigurasi model hasil resolusi env."""

    kind: str
    model: str
    api_base: str | None = None

    @property
    def supports_inline_data(self) -> bool:
        """Gemini menerima file inline; LiteLLM (Groq teks) tidak."""
        return self.kind == KIND_GEMINI


@runtime_checkable
class StructuredLlmClient(Protocol):
    """Antarmuka yang dipakai pipeline + assess."""

    @property
    def supports_inline_data(self) -> bool:
        """True kalau model bisa menerima file sebagai `Part inline_data`."""
        ...

    async def complete(
        self,
        *,
        prompt: str,
        schema: type[BaseModel],
        instruction: str | None = None,
        inline_parts: Sequence[InlineData] | None = None,
    ) -> BaseModel:
        """Jalankan satu panggilan terstruktur, kembalikan instance `schema`."""
        ...


def resolve_model_spec() -> ModelSpec:
    """Baca env dari `api.core.config` (tidak ada bacaan `os.environ` liar)."""
    settings = get_settings()
    model = (settings.model or "").strip()
    base_url = (settings.litellm_base_url or "").strip()

    if base_url:
        return ModelSpec(
            kind=KIND_LITELLM,
            model=model or "groq/llama-3.1-8b-instant",
            api_base=base_url,
        )
    if model.lower().startswith("mistral/"):
        # LiteLLM native provider — tanpa proxy; kunci dari api/.env diekspor
        # ke env proses karena litellm membaca MISTRAL_API_KEY dari os.environ.
        if settings.mistral_api_key:
            os.environ.setdefault("MISTRAL_API_KEY", settings.mistral_api_key)
        return ModelSpec(kind=KIND_LITELLM, model=model, api_base=None)
    return ModelSpec(kind=KIND_GEMINI, model=model or DEFAULT_GEMINI_MODEL)


class AdkStructuredClient:
    """Client terstruktur di atas ADK `LlmAgent` + `Runner` (Apache-2.0, §9).

    Satu `LlmAgent` dibangun per panggilan supaya `output_schema` bisa diganti
    (QuestionSet dengan jumlah berbeda, PenilaianAI, dst.). Sesi in-memory dibuat
    per panggilan supaya tidak ada state yang bocor antar tahap.
    """

    def __init__(self, spec: ModelSpec, *, instruction: str | None = None) -> None:
        self.spec = spec
        self._instruction = instruction
        self._model = self._build_model(spec)

    @property
    def supports_inline_data(self) -> bool:
        return self.spec.supports_inline_data

    @staticmethod
    def _build_model(spec: ModelSpec):
        if spec.kind == KIND_LITELLM:
            from google.adk.models.lite_llm import LiteLlm

            kwargs = {}
            if spec.api_base:
                kwargs["api_base"] = spec.api_base
            return LiteLlm(model=spec.model, **kwargs)

        from google.adk.models.google_llm import Gemini

        return Gemini(model=spec.model)

    async def complete(
        self,
        *,
        prompt: str,
        schema: type[BaseModel],
        instruction: str | None = None,
        inline_parts: Sequence[InlineData] | None = None,
    ) -> BaseModel:
        from google.adk.agents import LlmAgent
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types

        attachments: tuple[InlineData, ...] = tuple(inline_parts or ())
        if attachments and not self.supports_inline_data:
            # Model teks tidak bisa menerima binary; pipeline sudah memutuskan
            # ini, tapi tetap dijaga di sini supaya tidak pernah diam-diam drop.
            logger.warning(
                "model=%s tidak mendukung inline data; abaikan %d part",
                self.spec.model,
                len(attachments),
            )
            attachments = ()

        agent = LlmAgent(
            name=WORKER_AGENT_NAME,
            model=self._model,
            instruction=instruction or self._instruction or _SYSTEM_ID,
            output_schema=schema,
            description="Worker terstruktur untuk pipeline AI Assignment Integrity Form.",
        )
        session_service = InMemorySessionService()
        session_id = uuid.uuid4().hex
        await session_service.create_session(
            app_name=APP_NAME, user_id=WORKER_USER_ID, session_id=session_id
        )
        runner = Runner(
            app_name=APP_NAME,
            agent=agent,
            session_service=session_service,
        )

        parts = [
            types.Part.from_bytes(data=item.data, mime_type=item.mime_type)
            for item in attachments
        ]
        parts.append(types.Part(text=prompt))

        raw: str | None = None
        async for event in runner.run_async(
            user_id=WORKER_USER_ID,
            session_id=session_id,
            new_message=types.Content(role="user", parts=parts),
        ):
            if getattr(event, "error_message", None):
                raise ModelCallError(f"model error: {event.error_message}")
            if event.is_final_response() and event.content and event.content.parts:
                text = "".join(part.text for part in event.content.parts if part.text)
                if text.strip():
                    raw = text

        if raw is None:
            raise ModelCallError("model tidak mengembalikan respons final")
        try:
            return schema.model_validate_json(raw)
        except Exception as exc:  # noqa: BLE001 — output rusak harus jadi error yang jelas
            raise ModelCallError(f"output model tidak sesuai skema: {exc}") from exc


def build_client() -> StructuredLlmClient:
    """Bangun client dari env. Tidak ada panggilan jaringan di titik ini."""
    spec = resolve_model_spec()
    logger.info(
        "AI lane aktif: kind=%s model=%s api_base=%s inline_data=%s",
        spec.kind,
        spec.model,
        spec.api_base or "-",
        spec.supports_inline_data,
    )
    return AdkStructuredClient(spec, instruction=_SYSTEM_ID)


__all__ = [
    "DEFAULT_GEMINI_MODEL",
    "InlineData",
    "KIND_GEMINI",
    "KIND_LITELLM",
    "ModelCallError",
    "ModelSpec",
    "StructuredLlmClient",
    "AdkStructuredClient",
    "build_client",
    "resolve_model_spec",
]