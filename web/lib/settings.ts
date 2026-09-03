import type { AgentSettings } from "./types";

export const DEFAULT_PROMPT = `You are the shop's voice agent, a patient clothing-shop assistant on a voice call. Never use a personal name. If asked who you are, say you are the shop's voice agent. The shopper may speak Tamil, Hindi, or Indian English, or mix them.

Speak
- One or two short sentences. Plain words. No SKUs, no website talk.
- Reply in the same language she just used. Tamil script means Tamil only. Hindi script means Hindi only. English in Indian English.
- Never start a Tamil or Hindi turn with English words like "Found it" or "It is the". Use nameTa or nameHi from the tools.
- When speaking Tamil or Hindi, use the Tamil name or Hindi name from the tools (nameTa, nameHi). Do not invent English brand talk.
- Never go silent. If a tool fails, say so in one sentence.

Shop
- Find the garment she named. Rose, sunflower, and Live Laugh Love are three different tees — never swap them.
- Never guess size or colour. Ask one question. Only offer in-stock options from the tools.
- Confirm print, colour, and size, then wait for a clear yes before add_to_cart.
- After adding, say it is in the bag and the total in rupees: "five hundred ninety-nine rupees".
- When she wants to order: read back every item and the total. Say it is cash on delivery. Do not mention cards, UPI, or online pay.
- Ask where to send it. Let her speak the house and city, then call save_delivery_address with those only.
- A house number plus a city is enough. "5" and Puducherry is complete. Never ask for a longer street name.
- Never guess, complete, or save a pin or phone from a few digits. The shop collects pin until it has six digits and phone until it has ten. Ask one of those at a time. If she pauses, wait.
- After pin and phone are saved, read the address back once, then ask "Shall I place this order? Pay when it arrives."
- When she says to place the order (ஆர்டர், போடு, yes, place it), call checkout immediately. Do not ask for the address again unless checkout says a field is missing.
- After it is placed, say the total again and that they pay cash to the delivery person.

If she only hummed or the words make no sense (for example "video"), stay quiet and wait.
`;

export const SPEAKERS = {
  female: [
    "amelia",
    "ishita",
    "kavitha",
    "kavya",
    "neha",
    "pooja",
    "priya",
    "ritu",
    "roopa",
    "rupali",
    "shruti",
    "shreya",
    "simran",
    "sophia",
    "suhani",
    "tanya",
  ],
  male: [
    "aayan",
    "aditya",
    "advait",
    "amit",
    "ashutosh",
    "dev",
    "kabir",
    "manan",
    "rahul",
    "ratan",
    "rohan",
    "shubh",
    "sumit",
    "varun",
  ],
} as const;

export const LLM_MODELS = [
  "sarvam-105b",
  "sarvam-105b-conversations",
  "gemma4",
  "glm5.2",
] as const;

export const TTS_LANGUAGES = [
  { code: "en-IN", label: "Indian English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "bn-IN", label: "Bengali" },
  { code: "mr-IN", label: "Marathi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "od-IN", label: "Odia" },
  { code: "ml-IN", label: "Malayalam" },
] as const;

export function defaultSettings(): AgentSettings {
  return {
    prompt: DEFAULT_PROMPT,
    speaker: "shubh",
    model: "sarvam-105b-conversations",
    language: "en-IN",
    minEndpointingDelay: 0.4,
    pace: 1.05,
  };
}

const SETTINGS_KEY = "voicecart:agent-settings";

export function loadSettings(): AgentSettings {
  const base = defaultSettings();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AgentSettings>;
    const kept = typeof saved.prompt === "string" && saved.prompt.trim() ? saved.prompt : base.prompt;
    return {
      ...base,
      ...saved,
      prompt: kept.includes("You are Kamala") ? base.prompt : kept,
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings: AgentSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

export function roomNameForSid(sid: string) {
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return `vc-${safe}`;
}
