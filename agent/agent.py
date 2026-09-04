from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

import aiohttp
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobExecutorType,
    RunContext,
    StopResponse,
    WorkerOptions,
    cli,
    function_tool,
    metrics,
)
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.plugins import sarvam

from prompts import DEFAULT_PROMPT
from store_tools import StoreClient

load_dotenv(Path(__file__).resolve().parent / ".env")

SARVAM_CHAT_V1 = "https://api.sarvam.ai/v1"
V1_CHAT_MODELS = {"sarvam-105b", "sarvam-105b-conversations"}
SHOP_STT_PROMPT = (
    "Indian clothing shop. Prefer these words: rose, sunflower, marigold, jasmine, "
    "lotus, daisy, hibiscus, gulab, surajmukhi, cotton, t-shirt, kurta, saree, "
    "small, medium, large, extra large, white, blush, indigo, maroon, "
    "pin code, nagar, sector, gully, house number, cash on delivery, "
    "गुलाब सूरजमुखी गेंदा चमेली कमल कुर्ता साड़ी टीशर्ट नाइटी, "
    "ரோஜா சூரியகாந்தி சாமந்தி மல்லி தாமரை குர்தா புடவை டி-ஷர்ட் நைட்டி."
)
DIGIT_STT_PROMPT = (
    "The speaker is saying digits for a PIN code or phone number. "
    "Transcribe only digits 0-9. English, Hindi, or Tamil number words: "
    "zero one two three four five six seven eight nine, "
    "shunya ek do teen char paanch chhe saat aath nau, "
    "பூஜ்ஜியம் ஒன்று இரண்டு மூன்று நான்கு ஐந்து ஆறு ஏழு எட்டு ஒன்பது. "
    "Do not invent extra digits. Keep leading zeros."
)
_FILLER = {
    "hmm",
    "hm",
    "mm",
    "mmm",
    "uh",
    "um",
    "ah",
    "aah",
    "huh",
    "video",
    "audio",
    "...",
}
_SKIP_PHONE = re.compile(
    r"\b(no phone|skip phone|don't have|dont have|nahi|வேண்டாம்)\b",
    re.IGNORECASE,
)
_PLACE_ORDER = re.compile(
    r"(ஆர்டர்\s*(செய்து|போடு|போட்டு|பண்ணு)?|place\s+(the\s+)?order|confirm\s+(the\s+)?order|"
    r"ऑर्डर\s*(कर|दे)|போட்டுவிடு|வைத்துவிடு|order\s+(it|now))",
    re.IGNORECASE,
)
_YES_PLACE = re.compile(
    r"^(yes|yeah|yep|ok|okay|ஆமாம்|ஆமா|ஆம்|சரி|हाँ|हां|जी|place it)$",
    re.IGNORECASE,
)
_DIGIT_WORDS = (
    "zero",
    "oh",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "shunya",
    "soonya",
    "ek",
    "do",
    "teen",
    "char",
    "paanch",
    "panch",
    "chhe",
    "saat",
    "aath",
    "nau",
    "பூஜ்ஜியம்",
    "சுழியம்",
    "ஒன்று",
    "ஒன்னு",
    "இரண்டு",
    "ரெண்டு",
    "மூன்று",
    "மூணு",
    "நான்கு",
    "நாலு",
    "ஐந்து",
    "அஞ்சு",
    "ஆறு",
    "ஏழு",
    "எட்டு",
    "ஒன்பது",
)
_SHOP_KEYTERMS = [
    "rose",
    "sunflower",
    "marigold",
    "jasmine",
    "kurta",
    "saree",
    "cotton",
]
_DIGIT_KEYTERMS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "shunya",
    "பூஜ்ஜியம்",
    "ஒன்று",
    "இரண்டு",
    "மூன்று",
    "நான்கு",
    "ஐந்து",
    "ஆறு",
    "ஏழு",
    "எட்டு",
    "ஒன்பது",
]

logger = logging.getLogger("voicecart.agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

STORE_API_URL = os.getenv("STORE_API_URL", "http://127.0.0.1:3000").replace(
    "http://localhost", "http://127.0.0.1"
)
AGENT_SHARED_SECRET = os.getenv("AGENT_SHARED_SECRET", "dev-agent-secret-change-me")


def _ms(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 20:
        n *= 1000
    return int(n)


def _looks_like_digits(text: str) -> bool:
    if _PLACE_ORDER.search(text):
        return False
    tokens = re.findall(r"[0-9]+|[a-zA-Z]+|[\u0900-\u097F]+|[\u0B80-\u0BFF]+", text.lower())
    if not tokens:
        return False
    digit_words = set(_DIGIT_WORDS)
    digitish = sum(1 for t in tokens if t.isdigit() or t in digit_words)
    if digitish >= 2 and digitish / len(tokens) >= 0.55:
        return True
    return sum(ch.isdigit() for ch in text) >= 4 and len(tokens) <= 4


def _detect_speak_lang(text: str) -> str:
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "ta-IN"
    if re.search(r"[\u0900-\u097F]", text):
        return "hi-IN"
    return "en-IN"


_LANG_HINT = {
    "ta-IN": "Reply in Tamil only. Do not use English. Use the Tamil name (nameTa). Ask size in Tamil.",
    "hi-IN": "Reply in Hindi only. Do not use English. Use the Hindi name (nameHi). Ask size in Hindi.",
}
_LANG_EXTRA = {
    "ta-IN": "\n\nHARD RULE: Speak only Tamil this call. Use nameTa. No English sentences.",
    "hi-IN": "\n\nHARD RULE: Speak only Hindi this call. Use nameHi. No English sentences.",
}

_GREET = {
    "ta-IN": (
        "வணக்கம் {name}. நான் கடையின் வாய்ஸ் ஏஜென்ட். இன்னைக்கு என்ன வாங்கணும்?",
        "வணக்கம். நான் கடையின் வாய்ஸ் ஏஜென்ட். இன்னைக்கு என்ன வாங்கணும்?",
    ),
    "hi-IN": (
        "नमस्ते {name}. मैं दुकान का वॉइस एजेंट हूँ. आज क्या लेना है?",
        "नमस्ते. मैं दुकान का वॉइस एजेंट हूँ. आज क्या लेना है?",
    ),
    "en-IN": (
        "Hello {name}. I am the shop's voice agent. What would you like to buy today?",
        "Hello. I am the shop's voice agent. What would you like to buy today?",
    ),
}


class ShoppingAgent(Agent):
    def __init__(self, instructions: str, store: StoreClient, shopper_name: Optional[str] = None):
        super().__init__(instructions=instructions)
        self.store = store
        self.shopper_name = shopper_name
        self._speak_lang = "en-IN"
        self._base_instructions = instructions

    def _lock_turn_language(self, new_message: ChatMessage) -> None:
        hint = _LANG_HINT.get(self._speak_lang)
        if not hint:
            return
        parts = list(new_message.content or [])
        for i, chunk in enumerate(parts):
            if isinstance(chunk, str):
                if hint in chunk:
                    return
                parts[i] = f"{chunk}\n\n[{hint}]"
                new_message.content = parts
                return
        parts.append(f"[{hint}]")
        new_message.content = parts

    def _localize_tool(self, raw: str) -> str:
        try:
            data = json.loads(raw)
        except Exception:
            return raw
        lang = self._speak_lang
        items = data.get("products")
        if items is None and isinstance(data.get("product"), dict):
            items = [data["product"]]
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                if lang == "ta-IN" and item.get("nameTa"):
                    item["name"] = item["nameTa"]
                elif lang == "hi-IN" and item.get("nameHi"):
                    item["name"] = item["nameHi"]
        if lang == "ta-IN":
            data["reply_in"] = "Tamil"
            data["instruction"] = "Speak every word in Tamil. Use nameTa."
        elif lang == "hi-IN":
            data["reply_in"] = "Hindi"
            data["instruction"] = "Speak every word in Hindi. Use nameHi."
        return json.dumps(data, ensure_ascii=False)

    async def _follow_shopper_language(self, text: str) -> None:
        code = _detect_speak_lang(text)
        # STT often romanizes Tamil/Hindi. Do not drop a language the shopper already chose.
        if code == "en-IN" and self._speak_lang in ("ta-IN", "hi-IN"):
            return
        switched = self._speak_lang != code
        self._speak_lang = code
        if switched:
            tts = self.session.tts
            if tts is not None and hasattr(tts, "update_options"):
                try:
                    tts.update_options(target_language_code=code)
                    logger.info("tts language -> %s", code)
                except Exception:
                    logger.exception("tts language switch failed")
            extra = _LANG_EXTRA.get(code, "")
            try:
                await self.update_instructions(self._base_instructions + extra)
            except Exception:
                logger.exception("instruction language update failed")

    def _digit_line(self, data: dict[str, Any], fallback: str) -> str:
        lang = self._speak_lang
        field = data.get("field")
        ready = bool(data.get("ready"))
        buffer = str(data.get("buffer") or "")
        need = int(data.get("need") or 0)
        heard = " ".join(buffer) if buffer else ""
        nxt = data.get("next")
        if lang == "ta-IN":
            if ready and nxt == "phone":
                return f"பின் கோடு {heard}. இப்போது பத்து இலக்க போன் எண் மெதுவாக சொல்லுங்க. நான் காத்திருக்கிறேன்."
            if ready and nxt == "confirm":
                return f"போன் {heard}."
            if not buffer:
                return (
                    "ஆறு இலக்க பின் கோடு மெதுவாக சொல்லுங்க. முடியும் வரை காத்திருக்கிறேன்."
                    if field == "pincode"
                    else "பத்து இலக்க போன் எண் மெதுவாக சொல்லுங்க. முடியும் வரை காத்திருக்கிறேன்."
                )
            return f"என்னிடம் {heard} இருக்கு. இன்னும் {need} வேணும்."
        if lang == "hi-IN":
            if ready and nxt == "phone":
                return f"पिन कोड {heard}. अब दस अंक का फोन नंबर धीरे से बोलिए. मैं इंतज़ार करूँगी."
            if ready and nxt == "confirm":
                return f"फोन {heard}."
            if not buffer:
                return (
                    "छह अंक का पिन कोड धीरे से बोलिए. मैं अंत तक इंतज़ार करूँगी."
                    if field == "pincode"
                    else "दस अंक का फोन नंबर धीरे से बोलिए. मैं अंत तक इंतज़ार करूँगी."
                )
            return f"मेरे पास {heard} है. अभी {need} और चाहिए."
        return fallback

    async def on_enter(self) -> None:
        extra = _LANG_EXTRA.get(self._speak_lang, "")
        if extra:
            try:
                await self.update_instructions(self._base_instructions + extra)
            except Exception:
                logger.exception("instruction language update failed")
        named, plain = _GREET.get(self._speak_lang, _GREET["en-IN"])
        line = named.format(name=self.shopper_name) if self.shopper_name else plain
        logger.info("greeting lang=%s line=%s", self._speak_lang, line)
        try:
            await self.session.say(line, allow_interruptions=True)
            logger.info("greeting spoken")
        except Exception:
            logger.exception("greeting failed")

    def _stretch_listening(self, on: bool) -> None:
        if getattr(self, "_digit_listen", False) == on:
            return
        self._digit_listen = on
        stt = self.session.stt
        if stt is not None and hasattr(stt, "update_options"):
            try:
                stt.update_options(
                    vad_min_silence_ms=2800 if on else 500,
                    mode="transcribe",
                    prompt=DIGIT_STT_PROMPT if on else SHOP_STT_PROMPT,
                )
            except Exception:
                logger.exception("stt digit mode failed")
        try:
            self.session.update_options(
                endpointing_opts={
                    "min_delay": 1.6 if on else 0.4,
                    "max_delay": 5.0 if on else 1.6,
                },
                keyterms=_DIGIT_KEYTERMS if on else _SHOP_KEYTERMS,
            )
        except Exception:
            logger.exception("session digit endpointing failed")
        preemptive = getattr(self.session.options, "preemptive_generation", None)
        if isinstance(preemptive, dict):
            preemptive["enabled"] = not on

    def _maybe_digit_mode(self, payload: str) -> None:
        try:
            data = json.loads(payload)
        except Exception:
            return
        missing = data.get("missing") or []
        if data.get("status") == "collecting_digits" or "pincode" in missing or data.get("field") in ("pincode", "phone"):
            self._stretch_listening(data.get("next") != "confirm")
        if data.get("next") == "confirm" or data.get("orderId"):
            self._stretch_listening(False)

    async def _handle_digit_turn(self, spoken: str, field: Optional[str]) -> None:
        raw = await self.store.collect_digits(spoken, field)
        self._maybe_digit_mode(raw)
        try:
            data = json.loads(raw)
        except Exception:
            self.session.say("Please say the digits slowly.", allow_interruptions=True)
            raise StopResponse()
        if data.get("ok") is False:
            self.session.say("I could not hear those digits. Please say them again, slowly.", allow_interruptions=True)
            raise StopResponse()
        line = self._digit_line(data, data.get("message") or "Please say the digits slowly.")
        if data.get("ready") and data.get("next") == "confirm":
            cart_raw = await self.store.cart()
            try:
                cart = json.loads(cart_raw)
            except Exception:
                cart = {}
            address = cart.get("address") or {}
            parts = [address.get("line1"), address.get("city")]
            if address.get("pincode"):
                parts.append("pin " + " ".join(address["pincode"]))
            if address.get("phone"):
                parts.append("phone " + " ".join(address["phone"]))
            where = ", ".join(p for p in parts if p)
            extra = line
            if self._speak_lang == "ta-IN":
                line = f"{extra} {where} க்கு அனுப்புவேன். ஆர்டர் போடட்டுமா? வந்ததும் பணம் கொடுங்க."
            elif self._speak_lang == "hi-IN":
                line = f"{extra} मैं {where} भेजूँगी. ऑर्डर कर दूँ? आने पर नकद दीजिएगा."
            else:
                line = f"{extra} I will send it to {where}. Shall I place this order? Pay when it arrives."
            self._stretch_listening(False)
        self.session.say(line, allow_interruptions=True)
        raise StopResponse()

    def _wants_checkout(self, text: str, cart: dict[str, Any]) -> bool:
        if not cart.get("items"):
            return False
        if _PLACE_ORDER.search(text):
            return True
        address = cart.get("address") or {}
        if address.get("line1") and address.get("pincode") and not cart.get("digitField"):
            return bool(_YES_PLACE.match(text.strip()))
        return False

    async def _place_order_now(self) -> bool:
        raw = await self.store.checkout()
        self._stretch_listening(False)
        try:
            data = json.loads(raw)
        except Exception:
            return False
        order_id = data.get("orderId")
        if not order_id:
            return False
        total = data.get("total")
        rupees = f"{total} " if total is not None else ""
        if self._speak_lang == "ta-IN":
            line = f"ஆர்டர் போட்டாச்சு. மொத்தம் {rupees}ரூபாய். வந்ததும் பணம் கொடுங்க."
        elif self._speak_lang == "hi-IN":
            line = f"ऑर्डर हो गया. कुल {rupees}रुपये. आने पर नकद दीजिएगा."
        else:
            line = f"Order placed. Total {rupees}rupees. Pay cash when it arrives."
        self.session.say(line, allow_interruptions=True)
        return True

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        text = (new_message.text_content or "").strip()
        if text:
            await self._follow_shopper_language(text)
            self._lock_turn_language(new_message)
            hint = _LANG_HINT.get(self._speak_lang)
            if hint:
                turn_ctx.add_message(role="system", content=hint)
        cleaned = "".join(ch for ch in text.lower() if ch.isalnum() or ch.isspace()).strip()
        cart: dict[str, Any] = {}
        try:
            cart = json.loads(await self.store.cart())
        except Exception:
            pass
        if self._wants_checkout(text, cart):
            if await self._place_order_now():
                raise StopResponse()
        field = cart.get("digitField")
        if field in ("pincode", "phone"):
            self._stretch_listening(True)
            if not cleaned or cleaned in _FILLER:
                raise StopResponse()
            if _looks_like_digits(text) or (field == "phone" and _SKIP_PHONE.search(text)):
                await self._handle_digit_turn(text, field)
        if not cleaned or cleaned in _FILLER:
            raise StopResponse()

    @function_tool()
    async def search_products(self, context: RunContext, query: str) -> str:
        """Search clothes by flower, quote, fabric, brand, Hindi name, or Tamil name."""
        return self._localize_tool(await self.store.search(query))

    @function_tool()
    async def describe_product(self, context: RunContext, product_id: str) -> str:
        """Spoken description of one product, including print and stock."""
        return self._localize_tool(await self.store.describe(product_id))

    @function_tool()
    async def get_product_options(self, context: RunContext, product_id: str) -> str:
        """In-stock sizes and colours for one product."""
        return self._localize_tool(await self.store.options(product_id))

    @function_tool()
    async def add_to_cart(
        self,
        context: RunContext,
        product_id: str,
        quantity: int = 1,
        size: Optional[str] = None,
        color: Optional[str] = None,
    ) -> str:
        """Add after a clear yes. If size or colour is missing, ask next."""
        return await self.store.add(product_id, quantity, size, color)

    @function_tool()
    async def remove_from_cart(self, context: RunContext, sku: str) -> str:
        """Remove one bag line using the sku from get_cart."""
        return await self.store.remove(sku)

    @function_tool()
    async def get_cart(self, context: RunContext) -> str:
        """Current bag, running total, and saved delivery address."""
        return await self.store.cart()

    @function_tool()
    async def save_delivery_address(
        self,
        context: RunContext,
        spoken: str,
        house: Optional[str] = None,
        area: Optional[str] = None,
        city: Optional[str] = None,
        landmark: Optional[str] = None,
    ) -> str:
        """Save house, area, and city. Never pass pin or phone here — those are collected digit by digit."""
        result = await self.store.save_address(
            spoken,
            house,
            area,
            city,
            None,
            None,
            landmark,
        )
        self._maybe_digit_mode(result)
        return result

    @function_tool()
    async def checkout(self, context: RunContext) -> str:
        """Place the COD order now. Call this as soon as she says to order. Do not re-ask the address first."""
        self._stretch_listening(False)
        return await self.store.checkout()


async def fetch_config(http: aiohttp.ClientSession, room_name: str) -> dict[str, Any]:
    url = f"{STORE_API_URL}/api/session/{quote(room_name, safe='')}/config"
    try:
        async with http.get(url, timeout=aiohttp.ClientTimeout(total=8)) as res:
            if res.status == 200:
                return await res.json()
    except Exception:
        logger.exception("config fetch failed for %s", room_name)
    return {
        "sid": "console",
        "roomName": room_name,
        "settings": {
            "prompt": DEFAULT_PROMPT,
            "speaker": "shubh",
            "model": "sarvam-105b-conversations",
            "language": "en-IN",
            "minEndpointingDelay": 0.4,
            "pace": 1.05,
        },
    }


def _with_ws_heartbeat(session: aiohttp.ClientSession) -> aiohttp.ClientSession:
    original = session.ws_connect

    async def ws_connect(*args: Any, **kwargs: Any):
        kwargs.setdefault("heartbeat", 20.0)
        return await original(*args, **kwargs)

    session.ws_connect = ws_connect  # type: ignore[method-assign]
    return session


def build_llm(settings: dict[str, Any]):
    model = settings.get("model") or "sarvam-105b-conversations"
    # Plugin default for sarvam-105b is /v2, which is beta-gated on most keys.
    # Voice models belong on /v1 chat completions.
    kwargs: dict[str, Any] = {"model": model, "max_tokens": 140, "temperature": 0.3}
    if model in V1_CHAT_MODELS:
        kwargs["base_url"] = SARVAM_CHAT_V1
    return sarvam.LLM(**kwargs)


def build_stt(http: aiohttp.ClientSession):
    return sarvam.STTRealtime(
        language="auto",
        stream_type="balanced",
        mode="transcribe",
        endpointing="vad",
        encoding="linear16",
        prompt=SHOP_STT_PROMPT,
        vad_min_speech_ms=280,
        vad_min_silence_ms=500,
        http_session=http,
    )


def build_tts(settings: dict[str, Any], http: aiohttp.ClientSession):
    return sarvam.TTS(
        target_language_code=settings.get("language") or "en-IN",
        model="bulbul:v3",
        speaker=settings.get("speaker") or "shubh",
        pace=float(settings.get("pace") or 1.05),
        speech_sample_rate=24000,
        output_audio_codec="linear16",
        min_buffer_size=30,
        max_chunk_length=80,
        temperature=0.4,
        http_session=http,
    )


def build_session(settings: dict[str, Any], http: aiohttp.ClientSession) -> AgentSession:
    delay = float(settings.get("minEndpointingDelay") or 0.4)
    return AgentSession(
        vad=None,
        stt=build_stt(http),
        llm=build_llm(settings),
        tts=build_tts(settings, http),
        turn_handling={
            "turn_detection": "stt",
            "endpointing": {"min_delay": delay, "max_delay": 1.6},
            "interruption": {
                "min_duration": 0.55,
                "min_words": 2,
                "resume_false_interruption": True,
            },
            "preemptive_generation": {"enabled": False},
        },
    )


class LatencyTap:
    def __init__(self, store: StoreClient, room: Optional[rtc.Room]):
        self.store = store
        self.room = room
        self.turns: list[dict[str, Any]] = []
        self._current: dict[str, Any] = {"id": str(uuid.uuid4()), "at": int(time.time() * 1000)}

    def ingest(self, metric: Any) -> None:
        name = type(metric).__name__.lower()
        if "stt" in name:
            self._current["sttFinalMs"] = _ms(getattr(metric, "duration", None))
            self._current["transcript"] = getattr(metric, "transcript", None) or self._current.get("transcript")
        elif "llm" in name:
            self._current["llmTtftMs"] = _ms(getattr(metric, "ttft", None))
        elif "tts" in name:
            self._current["ttsTtfbMs"] = _ms(getattr(metric, "ttfb", None))
        parts = [
            self._current.get("sttFinalMs"),
            self._current.get("llmTtftMs"),
            self._current.get("ttsTtfbMs"),
        ]
        if all(p is not None for p in parts):
            self._current["turnTotalMs"] = int(sum(parts))
            self._flush()

    def _flush(self) -> None:
        turn = dict(self._current)
        self.turns.append(turn)
        logger.info(
            "turn latency stt=%s llm_ttft=%s tts_ttfb=%s total=%s transcript=%s",
            turn.get("sttFinalMs"),
            turn.get("llmTtftMs"),
            turn.get("ttsTtfbMs"),
            turn.get("turnTotalMs"),
            (turn.get("transcript") or "")[:80],
        )
        asyncio.create_task(self.store.post_telemetry(turn))
        if self.room:
            payload = json.dumps({"turns": self.turns[-12:]}).encode()
            asyncio.create_task(self.room.local_participant.publish_data(payload, topic="latency"))
        self._current = {"id": str(uuid.uuid4()), "at": int(time.time() * 1000)}


async def apply_live_settings(agent: ShoppingAgent, session: AgentSession, settings: dict[str, Any]) -> None:
    prompt = settings.get("prompt")
    if prompt:
        agent._base_instructions = prompt
    if settings.get("language"):
        agent._speak_lang = settings["language"]
    extra = _LANG_EXTRA.get(agent._speak_lang, "")
    await agent.update_instructions(agent._base_instructions + extra)
    tts = session.tts
    if tts is not None and hasattr(tts, "update_options"):
        kwargs: dict[str, Any] = {}
        if settings.get("speaker"):
            kwargs["speaker"] = settings["speaker"]
        if settings.get("language"):
            kwargs["target_language_code"] = settings["language"]
        if settings.get("pace") is not None:
            kwargs["pace"] = float(settings["pace"])
        try:
            tts.update_options(**kwargs)
        except Exception:
            logger.exception("tts.update_options failed")
    llm = session.llm
    if llm is not None and hasattr(llm, "update_options") and settings.get("model"):
        try:
            llm.update_options(model=settings["model"])
        except Exception:
            logger.exception("llm.update_options failed")


async def entrypoint(ctx: JobContext) -> None:
    metadata_ready = asyncio.Event()

    def _on_meta(_old: str, _new: str) -> None:
        metadata_ready.set()

    ctx.room.on("room_metadata_changed", _on_meta)
    await ctx.connect()

    room_name = ctx.room.name or "console"
    http = _with_ws_heartbeat(aiohttp.ClientSession())
    ctx.add_shutdown_callback(http.close)

    cfg = await fetch_config(http, room_name)
    sid = cfg.get("sid")
    if not sid or sid == room_name:
        base = room_name.split("--")[0]
        if base.startswith("vc-guest-"):
            sid = f"guest:{base[len('vc-guest-'):]}"
        elif base.startswith("vc-user-"):
            sid = f"user:{base[len('vc-user-'):]}"
        else:
            sid = base[3:] if base.startswith("vc-") else base
    cfg["sid"] = sid
    settings = cfg.get("settings") or {}
    if not settings.get("prompt"):
        settings["prompt"] = DEFAULT_PROMPT

    store = StoreClient(STORE_API_URL, sid, AGENT_SHARED_SECRET, http)
    agent = ShoppingAgent(settings["prompt"], store, shopper_name=cfg.get("shopperName"))
    agent._speak_lang = settings.get("language") or "en-IN"
    session = build_session(settings, http)
    tap = LatencyTap(store, ctx.room)

    @session.on("metrics_collected")
    def _on_metrics(ev: Any) -> None:
        metric = getattr(ev, "metrics", ev)
        try:
            metrics.log_metrics(metric)
        except Exception:
            pass
        tap.ingest(metric)

    def _on_data(pkt: rtc.DataPacket) -> None:
        if pkt.topic != "settings_update":
            return
        try:
            body = json.loads(pkt.data.decode("utf-8"))
            live = body.get("settings") or body
        except Exception:
            logger.exception("bad settings_update packet")
            return
        asyncio.create_task(apply_live_settings(agent, session, live))

    ctx.room.on("data_received", _on_data)

    @session.on("error")
    def _on_error(ev: Any) -> None:
        logger.error("session error: %s", ev)

    @session.on("user_input_transcribed")
    def _on_heard(ev: Any) -> None:
        logger.info("heard: %s", getattr(ev, "transcript", ev))

    logger.info("shop tools ready sid=%s store=%s", sid, STORE_API_URL)
    logger.info("session starting room=%s", room_name)
    try:
        await session.start(agent=agent, room=ctx.room, record=False)
        logger.info("session ended room=%s", room_name)
    except Exception:
        logger.exception("session crashed room=%s", room_name)
        raise


if __name__ == "__main__":
    # Hosts that only offer web services need the health server on their assigned port.
    # When the shop shares the container it owns $PORT, so AGENT_HEALTH_PORT wins.
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Free-tier CPU spikes to ~99% while spawning a job. Do not refuse
            # the only caller because of that, and keep one warm process so the
            # first "Start talking" click is not 15s late.
            load_threshold=float("inf"),
            num_idle_processes=1,
            job_executor_type=JobExecutorType.THREAD,
            initialize_process_timeout=60.0,
            job_memory_warn_mb=0,
            port=int(os.getenv("AGENT_HEALTH_PORT") or os.getenv("PORT") or 8081),
        )
    )
