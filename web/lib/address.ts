import type { DeliveryAddress, DigitField, NeedsAddress } from "./types";

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  nought: "0",
  shunya: "0",
  soonya: "0",
  sunya: "0",
  பூஜ்ஜியம்: "0",
  சுழியம்: "0",
  शून्य: "0",
  one: "1",
  ek: "1",
  ஒன்று: "1",
  ஒன்னு: "1",
  एक: "1",
  two: "2",
  do: "2",
  இரண்டு: "2",
  ரெண்டு: "2",
  दो: "2",
  three: "3",
  teen: "3",
  மூன்று: "3",
  மூணு: "3",
  तीन: "3",
  four: "4",
  char: "4",
  நான்கு: "4",
  நாலு: "4",
  चार: "4",
  five: "5",
  paanch: "5",
  panch: "5",
  ஐந்து: "5",
  அஞ்சு: "5",
  पांच: "5",
  पाँच: "5",
  six: "6",
  chhe: "6",
  che: "6",
  ஆறு: "6",
  छह: "6",
  seven: "7",
  saat: "7",
  ஏழு: "7",
  सात: "7",
  eight: "8",
  aath: "8",
  ath: "8",
  எட்டு: "8",
  आठ: "8",
  nine: "9",
  nau: "9",
  ஒன்பது: "9",
  ஒம்போது: "9",
  नौ: "9",
};

const SPOKEN: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
};

export const PIN_LENGTH = 6;
export const PHONE_LENGTH = 10;

const DIGIT_WORD_KEYS = Object.keys(DIGIT_WORDS).sort((a, b) => b.length - a.length);

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function consumeDigitWords(blob: string) {
  let i = 0;
  let out = "";
  while (i < blob.length) {
    const hit = DIGIT_WORD_KEYS.find((word) => blob.startsWith(word, i));
    if (!hit) return "";
    out += DIGIT_WORDS[hit];
    i += hit.length;
  }
  return out;
}

export function extractSpokenDigits(value: string) {
  const tokens = value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  let built = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) built += token;
    else if (DIGIT_WORDS[token]) built += DIGIT_WORDS[token];
    else built += consumeDigitWords(token);
  }
  return built || digitsOnly(value);
}

export function isCompletePin(digits: string) {
  return /^\d{6}$/.test(digits) && /^[1-8]/.test(digits);
}

export function isCompletePhone(digits: string) {
  return /^\d{10}$/.test(digits) && /^[6-9]/.test(digits);
}

export function looksLikeDigitSpeech(value: string) {
  const digits = extractSpokenDigits(value);
  if (digits.length >= 2) return true;
  const tokens = value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  const digitish = tokens.filter((t) => /^\d+$/.test(t) || DIGIT_WORDS[t]).length;
  return digitish / tokens.length >= 0.6;
}

export function speakDigits(value: string) {
  return value
    .split("")
    .map((d) => SPOKEN[d] ?? d)
    .join(" ");
}

export function speakPin(pincode: string) {
  return speakDigits(pincode);
}

export function formatAddressLines(address: DeliveryAddress) {
  const lines = [address.line1];
  if (address.area) lines.push(address.area);
  if (address.landmark) lines.push(`Near ${address.landmark.replace(/^near\s+/i, "")}`);
  lines.push(`${address.city} — ${address.pincode}`);
  if (address.phone) lines.push(`Phone ${address.phone}`);
  return lines;
}

export function spokenReadback(address: DeliveryAddress) {
  const parts = [address.line1];
  if (address.area) parts.push(address.area);
  if (address.landmark) parts.push(`near ${address.landmark.replace(/^near\s+/i, "")}`);
  parts.push(address.city);
  if (address.pincode) parts.push(`pin ${speakDigits(address.pincode)}`);
  if (address.phone) parts.push(`phone ${speakDigits(address.phone)}`);
  return parts.filter(Boolean).join(", ");
}

export type AddressDraft = {
  spoken?: string;
  line1?: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  landmark?: string;
};

export type DigitCollectResult = {
  status: "collecting_digits";
  field: DigitField;
  buffer: string;
  have: number;
  need: number;
  ready: boolean;
  hearBack: string;
  value?: string;
  next?: DigitField | "confirm";
  message: string;
};

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function targetLen(field: DigitField) {
  return field === "pincode" ? PIN_LENGTH : PHONE_LENGTH;
}

function normalizePhone(digits: string) {
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function collectDigitBuffer(field: DigitField, spoken: string, previous: string): { buffer: string; ready: boolean } {
  const target = targetLen(field);
  const valid = field === "pincode" ? isCompletePin : isCompletePhone;
  const restartAt = field === "pincode" ? 5 : 8;
  let incoming = extractSpokenDigits(spoken);
  if (field === "phone") incoming = normalizePhone(incoming);

  if (!incoming) return { buffer: previous, ready: valid(previous) };
  if (incoming === previous) return { buffer: previous, ready: valid(previous) };
  if (valid(incoming)) return { buffer: incoming, ready: true };

  let buffer = incoming.length >= restartAt ? incoming : `${previous}${incoming}`;
  if (field === "phone") buffer = normalizePhone(buffer);
  if (buffer.length > target) {
    buffer = incoming.length >= 3 ? incoming.slice(-target) : buffer.slice(-target);
  }
  if (valid(buffer)) return { buffer, ready: true };

  if (buffer.length >= target && !valid(buffer.slice(0, target))) {
    const prefixOk = field === "pincode" ? /^[1-8]/.test(incoming) : /^[6-9]/.test(incoming);
    buffer = prefixOk ? incoming.slice(0, target) : previous;
  }
  if (buffer.length > target) buffer = buffer.slice(0, target);
  return { buffer, ready: valid(buffer) };
}

function pickComplete(field: DigitField, raw?: string) {
  if (!raw) return "";
  let digits = extractSpokenDigits(raw);
  if (field === "phone") {
    digits = normalizePhone(digits);
    if (isCompletePhone(digits)) return digits;
    if (digits.length > 10 && isCompletePhone(digits.slice(-10))) return digits.slice(-10);
    return "";
  }
  if (isCompletePin(digits)) return digits;
  if (digits.length > 6) {
    if (isCompletePin(digits.slice(-6))) return digits.slice(-6);
    if (isCompletePin(digits.slice(0, 6))) return digits.slice(0, 6);
  }
  return "";
}

const CITY_ALIASES: Array<{ match: RegExp; city: string }> = [
  { match: /புதுச்சேரி|பாண்டிச்சேரி|pondicherry|puducherry|\bpondy\b/i, city: "Puducherry" },
  { match: /சென்னை|\bchennai\b|\bmadras\b/i, city: "Chennai" },
  { match: /பெங்களூரு|பெங்களூர்|\bbangalore\b|\bbengaluru\b/i, city: "Bengaluru" },
  { match: /மும்பை|\bmumbai\b|\bbombay\b/i, city: "Mumbai" },
  { match: /தில்லி|\bnew delhi\b|\bdelhi\b/i, city: "Delhi" },
  { match: /ஹைதராபாத்|\bhyderabad\b/i, city: "Hyderabad" },
  { match: /கொல்கத்தா|\bkolkata\b|\bcalcutta\b/i, city: "Kolkata" },
  { match: /கோவை|கோயம்புத்தூர்|\bcoimbatore\b/i, city: "Coimbatore" },
  { match: /மதுரை|\bmadurai\b/i, city: "Madurai" },
  { match: /திருச்சி|\btrichy\b|\btiruchirappalli\b/i, city: "Tiruchirappalli" },
];

function spokenHouseNumber(raw: string) {
  const token = raw.toLowerCase().trim();
  if (/^\d{1,4}[a-z]?$/i.test(token)) return token.toUpperCase();
  if (DIGIT_WORDS[token]) return DIGIT_WORDS[token];
  const digits = extractSpokenDigits(token);
  return digits.length >= 1 && digits.length <= 4 ? digits : "";
}

export function parseSpokenAddress(spoken: string): AddressDraft {
  const text = clean(spoken);
  const out: AddressDraft = { spoken: text };
  if (!text) return out;

  const cityHit = CITY_ALIASES.find((c) => c.match.test(text));
  if (cityHit) out.city = cityHit.city;

  const houseMatch = text.match(
    /(?:வீட்டு\s*(?:எண்|நம்பர்)?|house\s*(?:number|no\.?)?|நம்பர்|नंबर)\s*([0-9]{1,4}[A-Za-z]?|[^\s,]+)/i,
  );
  if (houseMatch) {
    const house = spokenHouseNumber(houseMatch[1]);
    if (house) out.line1 = house;
  }

  const landmarkMatch =
    text.match(/([\p{L}\p{M}0-9]+(?:\s+[\p{L}\p{M}0-9]+){0,3})\s*(?:பக்கத்தில்|அருகில்|அருகே)/iu) ||
    text.match(/(?:near|nearby)\s+([^,.]+)/i);
  if (landmarkMatch) out.landmark = clean(landmarkMatch[1]);

  const areaMatch = text.match(
    /([\p{L}\p{M}0-9]+(?:\s+[\p{L}\p{M}0-9]+)?)\s*(?:பேட்டை|நகர்|தெரு|street|nagar|pettai)/iu,
  );
  if (areaMatch) out.area = clean(areaMatch[0]);

  const pin = pickComplete("pincode", text);
  if (pin) out.pincode = pin;
  const phone = pickComplete("phone", text);
  if (phone) out.phone = phone;
  return out;
}

function composeLine1(house: string, area?: string) {
  if (house && area && !house.includes(area)) return `${house}, ${area}`;
  return house || area || "";
}

export function mergeAddress(previous: DeliveryAddress | undefined, draft: AddressDraft): DeliveryAddress {
  const parsed = parseSpokenAddress(draft.spoken || "");
  const spoken = clean(draft.spoken) || previous?.spoken || "";
  const house = clean(draft.line1) || parsed.line1 || previous?.line1 || "";
  const area = clean(draft.area) || parsed.area || previous?.area;
  const line1 = composeLine1(house, area);
  const pincode =
    pickComplete("pincode", draft.pincode) ||
    parsed.pincode ||
    pickComplete("pincode", draft.spoken) ||
    previous?.pincode ||
    "";
  const phone =
    pickComplete("phone", draft.phone) ||
    parsed.phone ||
    pickComplete("phone", draft.spoken) ||
    previous?.phone ||
    "";
  return {
    line1,
    area,
    city: clean(draft.city) || parsed.city || previous?.city || "",
    pincode,
    phone: phone || undefined,
    landmark: clean(draft.landmark) || parsed.landmark || previous?.landmark,
    spoken,
  };
}

export function missingAddressFields(address: DeliveryAddress): Array<"line1" | "city" | "pincode"> {
  const missing: Array<"line1" | "city" | "pincode"> = [];
  if (!address.line1.trim()) missing.push("line1");
  if (address.city.trim().length < 2) missing.push("city");
  if (!/^\d{6}$/.test(address.pincode)) missing.push("pincode");
  return missing;
}

export function addressReady(address: DeliveryAddress | undefined): address is DeliveryAddress {
  return !!address && missingAddressFields(address).length === 0;
}

export function needsAddress(address: DeliveryAddress): NeedsAddress {
  const missing = missingAddressFields(address);
  const ask =
    missing.includes("line1") && missing.includes("city") && missing.includes("pincode")
      ? "Please tell me the house and the city first."
      : missing.includes("pincode")
        ? "Please say the six-digit pin code slowly, one digit after another."
        : missing.includes("city")
          ? "Which city should I send it to?"
          : "What is the house number?";
  return {
    status: "needs_address",
    missing,
    address,
    message: ask,
  };
}

export function digitProgressMessage(field: DigitField, buffer: string, ready: boolean): DigitCollectResult {
  const need = targetLen(field) - buffer.length;
  const hearBack = buffer ? speakDigits(buffer) : "";
  if (ready) {
    if (field === "pincode") {
      return {
        status: "collecting_digits",
        field,
        buffer,
        have: buffer.length,
        need: 0,
        ready: true,
        hearBack,
        value: buffer,
        next: "phone",
        message: `Pin ${hearBack}. Now the ten-digit phone number, slowly. I will wait.`,
      };
    }
    return {
      status: "collecting_digits",
      field,
      buffer,
      have: buffer.length,
      need: 0,
      ready: true,
      hearBack,
      value: buffer,
      next: "confirm",
      message: `Phone ${hearBack}.`,
    };
  }
  if (!buffer) {
    return {
      status: "collecting_digits",
      field,
      buffer,
      have: 0,
      need: targetLen(field),
      ready: false,
      hearBack: "",
      message:
        field === "pincode"
          ? "Please say all six pin-code digits, slowly. I will wait till you finish."
          : "Please say all ten phone digits, slowly. I will wait till you finish.",
    };
  }
  return {
    status: "collecting_digits",
    field,
    buffer,
    have: buffer.length,
    need,
    ready: false,
    hearBack,
    message: `I have ${hearBack}. Please say the remaining ${need}.`,
  };
}
