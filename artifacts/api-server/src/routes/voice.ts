import { Router, type IRouter } from "express";
import FormData from "form-data";
import fetch from "node-fetch";

const router: IRouter = Router();

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const SARVAM_BASE = "https://api.sarvam.ai";
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMessage = { role: "user" | "assistant"; content: string };

type ContactInfo = { name: string; upiId: string };

type ParsedCommand = {
  action:
    | "send"
    | "schedule"
    | "mandate"
    | "check_balance"
    | "history"
    | "unknown"
    | "clarify";
  amount: number | null;
  recipient: string | null;
  recipientUpiId: string | null;
  scheduledDate: string | null;
  scheduledTime?: string | null;
  mandateConfig?: MandateConfig | null;
  confidence: number;
  rawTranscript: string;
  agentReply: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  conversationHistory?: AgentMessage[];
  suggestedContacts?: ContactInfo[];
  detectedLanguage?: string;
};

type MandateConfig = {
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "as_presented";
  startDate: string;
  endDate?: string;
  maxAmount: number;
  remark: string;
};

// ─── Tool call shapes ─────────────────────────────────────────────────────────

type ToolCall =
  | {
      tool: "execute_payment";
      action: "send" | "schedule";
      amount: number;
      recipient: string;
      recipientUpiId: string;
      scheduledDate?: string;
      scheduledTime?: string;
      confidence: number;
    }
  | {
      tool: "setup_mandate";
      amount: number;
      recipient: string;
      recipientUpiId: string;
      frequency: "daily" | "weekly" | "monthly" | "yearly" | "as_presented";
      startDate: string;
      endDate?: string;
      maxAmount?: number;
      remark?: string;
      confidence: number;
    }
  | { tool: "check_balance" }
  | {
      tool: "get_transaction_history";
      limit?: number;
      contactName?: string;
    }
  | {
      tool: "ask_clarification";
      question: string;
      missingField:
        | "recipient"
        | "amount"
        | "date"
        | "action"
        | "confirmation"
        | "frequency";
      suggestedContacts?: ContactInfo[];
    };

// ─── Fuzzy contact matching ───────────────────────────────────────────────────

/**
 * Returns the best matching contact from the list given a raw name string.
 * Uses: exact match → starts-with → includes → Levenshtein distance.
 */
function fuzzyMatchContact(
  rawName: string,
  contacts: ContactInfo[]
): { match: ContactInfo | null; candidates: ContactInfo[] } {
  if (!rawName || !contacts.length) return { match: null, candidates: [] };

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const target = norm(rawName);
  const targetFirst = target.split(/\s+/)[0];

  // 1. Exact match
  const exact = contacts.find((c) => norm(c.name) === target);
  if (exact) return { match: exact, candidates: [] };

  // 2. First name exact
  const firstExact = contacts.find(
    (c) => norm(c.name).split(/\s+/)[0] === targetFirst
  );
  if (firstExact) return { match: firstExact, candidates: [] };

  // 3. Starts with or includes
  const startsWith = contacts.filter((c) =>
    norm(c.name).startsWith(targetFirst)
  );
  if (startsWith.length === 1) return { match: startsWith[0], candidates: [] };
  if (startsWith.length > 1) {
    return { match: null, candidates: startsWith.slice(0, 3) };
  }

  const includes = contacts.filter((c) => norm(c.name).includes(targetFirst));
  if (includes.length === 1) return { match: includes[0], candidates: [] };
  if (includes.length > 1) {
    return { match: null, candidates: includes.slice(0, 3) };
  }

  // 4. Levenshtein
  function lev(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  const scored = contacts
    .map((c) => ({
      contact: c,
      dist: Math.min(
        lev(target, norm(c.name)),
        lev(targetFirst, norm(c.name).split(/\s+/)[0])
      ),
    }))
    .sort((a, b) => a.dist - b.dist);

  // Threshold: distance <= 3 or <= 40% of name length
  const best = scored[0];
  if (best && best.dist <= Math.max(3, Math.floor(target.length * 0.4))) {
    return { match: best.contact, candidates: [] };
  }

  // Return top 3 as suggestions
  return {
    match: null,
    candidates: scored.slice(0, 3).map((s) => s.contact),
  };
}

// ─── TTS phrase bank ──────────────────────────────────────────────────────────

type TTSCtx = {
  amount?: number;
  name?: string;
  date?: string;
  isSchedule?: boolean;
  missingField?: string;
  fallback?: string;
  frequency?: string;
  candidates?: string;
};

const TTS_PHRASES: Record<
  string,
  Record<string, (ctx: TTSCtx) => string>
> = {
  "en-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `Schedule ₹${amount} to ${name} on ${date}. Confirm?`
        : `Send ₹${amount} to ${name}. Confirm?`,
    mandate: ({ amount, name, frequency }) =>
      `Set up ₹${amount} ${frequency} mandate to ${name}? Confirm?`,
    balance: ({ amount }) =>
      `Your balance is ₹${amount?.toLocaleString("en-IN")}.`,
    history: () => "Showing your recent transactions.",
    clarify: ({ missingField, fallback, candidates }) =>
      missingField === "recipient"
        ? candidates
          ? `I found a few contacts: ${candidates}. Which one?`
          : "Who should I send to?"
        : missingField === "amount"
        ? "How much to send?"
        : missingField === "date"
        ? "Which date should I schedule it for?"
        : missingField === "frequency"
        ? "How often? Daily, weekly, monthly, or yearly?"
        : fallback || "Could you say that again?",
    unknown: () => "I didn't catch that. Try: Send 500 to Rahul.",
    contact_not_found: ({ name, candidates }) =>
      candidates
        ? `I couldn't find "${name}". Did you mean ${candidates}?`
        : `I couldn't find "${name}" in your contacts. Who should I send to?`,
  },
  "hi-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name} ko ₹${amount} ${date} ko schedule karein? Confirm karein.`
        : `${name} ko ₹${amount} bhejein? Confirm karein.`,
    mandate: ({ amount, name, frequency }) =>
      `${name} ko ₹${amount} ${frequency} mandate set karein? Confirm karein.`,
    balance: ({ amount }) =>
      `Aapka balance ₹${amount?.toLocaleString("en-IN")} hai.`,
    history: () => "Aapke recent transactions dikha raha hoon.",
    clarify: ({ missingField, fallback, candidates }) =>
      missingField === "recipient"
        ? candidates
          ? `Kuch contacts mile: ${candidates}. Kaun sa?`
          : "Kisko bhejna hai?"
        : missingField === "amount"
        ? "Kitna bhejna hai?"
        : missingField === "date"
        ? "Kab bhejna hai?"
        : missingField === "frequency"
        ? "Kitni baar? Daily, weekly, monthly, ya yearly?"
        : fallback || "Dobara bolein please.",
    unknown: () => "Samajh nahi aaya. Bolein: Rahul ko 500 bhejo.",
    contact_not_found: ({ name, candidates }) =>
      candidates
        ? `"${name}" nahi mila. Kya aap ${candidates} kehna chahte hain?`
        : `"${name}" contacts mein nahi hai. Kisko bhejna hai?`,
  },
  "bn-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-ke ₹${amount} ${date}-e schedule korbo? Confirm korun.`
        : `${name}-ke ₹${amount} pathabo? Confirm korun.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-ke ₹${amount} ${frequency} mandate set korbo? Confirm korun.`,
    balance: ({ amount }) =>
      `Apnar balance ₹${amount?.toLocaleString("en-IN")}.`,
    history: () => "Apnar recent transactions dekhachhi.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Kake pathabo?"
        : missingField === "amount"
        ? "Koto taka pathabo?"
        : fallback || "Abar bolun please.",
    unknown: () => "Bujhte parini. Bolun: Rahul-ke 500 pathao.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts-e nei. Kake pathabo?`,
  },
  "ta-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-ku ₹${amount} ${date} anuppa schedule pannanuma? Confirm pannunga.`
        : `${name}-ku ₹${amount} anuppanuma? Confirm pannunga.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-ku ₹${amount} ${frequency} mandate vaikkanuma? Confirm pannunga.`,
    balance: ({ amount }) =>
      `Unga balance ₹${amount?.toLocaleString("en-IN")}.`,
    history: () => "Unga recent transactions kaaturen.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Yaarukku anuppa?"
        : missingField === "amount"
        ? "Evvalavu anuppa?"
        : fallback || "Maadum sollunga.",
    unknown: () => "Puriyala. Sollunga: Rahul-ku 500 anuppu.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts-il illai. Yaarukku anuppa?`,
  },
  "te-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-ki ₹${amount} ${date} schedule cheyyanama? Confirm cheyyandi.`
        : `${name}-ki ₹${amount} pampinchanama? Confirm cheyyandi.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-ki ₹${amount} ${frequency} mandate pettanama? Confirm cheyyandi.`,
    balance: ({ amount }) =>
      `Meeru balance ₹${amount?.toLocaleString("en-IN")}.`,
    history: () => "Meeru recent transactions chupistunnanu.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Evvarike pampinchali?"
        : missingField === "amount"
        ? "Entha pampinchali?"
        : fallback || "Marla cheppandi.",
    unknown: () => "Artham kaala. Cheppandi: Rahul-ki 500 pampu.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts lo ledu. Evvarike pampinchali?`,
  },
  "kn-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-ge ₹${amount} ${date} schedule maadali? Confirm maadi.`
        : `${name}-ge ₹${amount} kaḷuhisali? Confirm maadi.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-ge ₹${amount} ${frequency} mandate maadali? Confirm maadi.`,
    balance: ({ amount }) =>
      `Nimma balance ₹${amount?.toLocaleString("en-IN")}.`,
    history: () => "Nimma recent transactions torsuttene.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Yarige kaḷuhisali?"
        : missingField === "amount"
        ? "Eshtu kaḷuhisali?"
        : fallback || "Matte heli please.",
    unknown: () => "Artavaagilla. Heli: Rahul-ge 500 kaḷuhisu.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts-nalli illa. Yarige kaḷuhisali?`,
  },
  "mr-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-la ₹${amount} ${date} la schedule karायचे? Confirm kara.`
        : `${name}-la ₹${amount} pathavayche? Confirm kara.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-la ₹${amount} ${frequency} mandate set karayche? Confirm kara.`,
    balance: ({ amount }) =>
      `Tumcha balance ₹${amount?.toLocaleString("en-IN")} aahe.`,
    history: () => "Tumche recent transactions daakhavtoy.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Kunala pathavayche?"
        : missingField === "amount"
        ? "Kiti pathavayche?"
        : fallback || "Parat sanga please.",
    unknown: () => "Samajla nahi. Sanga: Rahul-la 500 pathav.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts madhe nahi. Kunala pathavayche?`,
  },
  "gu-IN": {
    payment: ({ amount, name, isSchedule, date }) =>
      isSchedule
        ? `${name}-ne ₹${amount} ${date} e schedule karvu chhe? Confirm karo.`
        : `${name}-ne ₹${amount} moklavu chhe? Confirm karo.`,
    mandate: ({ amount, name, frequency }) =>
      `${name}-ne ₹${amount} ${frequency} mandate set karvu? Confirm karo.`,
    balance: ({ amount }) =>
      `Tamaro balance ₹${amount?.toLocaleString("en-IN")} chhe.`,
    history: () => "Tamara recent transactions batavun chhu.",
    clarify: ({ missingField, fallback }) =>
      missingField === "recipient"
        ? "Kone moklavanu chhe?"
        : missingField === "amount"
        ? "Ketlu moklavanu chhe?"
        : fallback || "Pharthi kaho please.",
    unknown: () => "Samajyu nahi. Kaho: Rahul-ne 500 mokal.",
    contact_not_found: ({ name }) =>
      `"${name}" contacts ma nathi. Kone moklavanu chhe?`,
  },
};

function buildTTSReply(
  type: "payment" | "mandate" | "balance" | "history" | "clarify" | "unknown" | "contact_not_found",
  languageCode: string,
  ctx: TTSCtx
): string {
  const lang = languageCode in TTS_PHRASES ? languageCode : "en-IN";
  const phrases = TTS_PHRASES[lang];
  const fn = phrases[type] ?? TTS_PHRASES["en-IN"][type];
  return fn(ctx).slice(0, 490);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function nextMonthStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().split("T")[0];
}

// ─── Language detection from transcript ───────────────────────────────────────

function detectLanguageFromText(text: string): string {
  // ── Unicode script ranges (definitive) ──
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";   // Devanagari → Hindi/Marathi
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";   // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";   // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";   // Bengali
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";   // Kannada
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";   // Gujarati

  // ── Roman transliteration fallback for Hindi ──
  // Catches Sarvam STT output when language_code is en-IN but user spoke Hindi
  const hindiRoman = /\b(bhejo|bhejdo|bhejiye|bhejna|bhej\b|ko\b|ki\b|ka\b|hai\b|hain\b|mujhe|aap\b|karo|karein|hazaar|hazar|sau\b|paanch|das\b|bees\b|teen\b|char\b|ek\s+sau|do\s+sau|kal\b|aaj\b|parso|kitna|bakiya|bacha|nahi|haan\b|mahine|mahina|roz\b|har\s+mahine|baje|subah|dopahar|raat\b|shaam|paise|rupaye|yahan|wahan|transfer\s+karo|send\s+karo|bhejdo|dijiye|dena|lena|nikalo|nikaalna)\b/i;
  if (hindiRoman.test(text)) return "hi-IN";

  return "en-IN";
}

// ─── Ollama system prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(
  contacts: ContactInfo[],
  balance: number
): string {
  const contactList = contacts
    .map((c) => `  - "${c.name}" → ${c.upiId}`)
    .join("\n");
  const today = todayStr();
  const tomorrow = addDays(1);
  const dayAfter = addDays(2);
  const nextMonth = nextMonthStart();

  return `You are a UPI payment intent extractor for an Indian fintech app. Today is ${today}. User balance: ₹${balance}.

Available contacts (use EXACT names and UPI IDs from this list):
${contactList}

OUTPUT RULES:
- Output ONLY a single valid JSON object. No prose. No markdown. No explanation.
- Use ONLY tools listed below.
- Map contact names loosely — "Rahul", "Raul", "Rahulji" all match "Rahul Sharma" if present.
- If a name is spoken but doesn't match any contact, still output their spoken name in "recipient" and mark upiId as "" — do NOT invent a UPI ID.

DATE HINTS (resolve to YYYY-MM-DD):
  kal / naalai / repu / naale / kaale / tomorrow → ${tomorrow}
  parso / naalandru / day after / parmodhe → ${dayAfter}
  next month / agla mahina → ${nextMonth}
  today / aaj → ${today}

TIME HINTS (resolve to HH:MM, 24-hour format):
  subah / morning + 10 → 10:00
  dopahar / afternoon + 2/3 → 14:00 / 15:00
  shaam / evening + 5/6 → 17:00 / 18:00
  raat / night + 8/9/10 → 20:00 / 21:00 / 22:00
  3 baje / 3 pm → 15:00 | 9 baje / 9 am → 09:00
  If time is mentioned, include "scheduledTime": "HH:MM" in execute_payment output.

NUMBER HINTS (Hindi/regional → digit, resolve carefully):
  ek/ik/one = 1
  do/dono/two = 2   ← IMPORTANT: "do" = 2 not 20; "do sau" = 200
  teen/three = 3
  char/four = 4
  paanch/ainthu/aidu/five = 5
  chhah/six = 6
  saat/seven = 7
  aath/eight = 8
  nau/nine = 9
  das/pathu/padi/hattu/ten = 10
  gyarah/eleven = 11 | barah/twelve = 12 | tera/thirteen = 13
  chaudah/fourteen = 14 | pandrah/fifteen = 15
  solah/sixteen = 16 | satrah/seventeen = 17 | atharah/eighteen = 18
  unnees/unnis/nineteen = 19
  bees/vees/twenty = 20
  pachees/twenty-five = 25 | tees/thirty = 30 | chalees/forty = 40
  pachaas/fifty = 50 | saath/sixty = 60 | sattar/seventy = 70
  assi/eighty = 80 | nabbe/ninety = 90
  sau/nooru/so/shô/hundred = 100
  hazaar/hajar/aayiram/veyyi/savira/thousand = 1000
  lakh/lacs = 100000
  COMBINATION RULE: "do hazaar" = 2000, "paanch sau" = 500, "do sau pachaas" = 250
  DIGIT RULE: if the user says a single digit word (ek, do, teen …) with "rupaye/rs/rupees" — treat as that single number ONLY.
  NEVER confuse do(2) with bees(20), teen(3) with tees(30), char(4) with chalees(40).

TOOLS:

1. execute_payment — both recipient AND amount are clear
   {
     "tool": "execute_payment",
     "action": "send" | "schedule",
     "amount": <number>,
     "recipient": "<spoken name>",
     "recipientUpiId": "<exact upiId from list or empty string>",
     "scheduledDate": "<YYYY-MM-DD or omit>",
     "scheduledTime": "<HH:MM or omit>",
     "confidence": <0.0–1.0>
   }

2. setup_mandate — recurring auto-debit / standing instruction / mandate
   {
     "tool": "setup_mandate",
     "amount": <number>,
     "recipient": "<spoken name>",
     "recipientUpiId": "<exact upiId or empty>",
     "frequency": "daily" | "weekly" | "monthly" | "yearly" | "as_presented",
     "startDate": "<YYYY-MM-DD>",
     "endDate": "<YYYY-MM-DD or omit>",
     "maxAmount": <number — same as amount if not specified>,
     "remark": "<short note>",
     "confidence": <0.0–1.0>
   }
   Trigger for: mandate, standing order, recurring, auto-pay, subscription, har mahine, monthly payment, repeat

3. check_balance — balance / bakiya / kitna paisa / kitna bacha / how much left / eshtu / evvalavu / ketlu
   { "tool": "check_balance" }

4. get_transaction_history — history / transactions / purana / past / recent / statement
   { "tool": "get_transaction_history", "limit": 5 }

5. ask_clarification — use when recipient OR amount is still unknown/ambiguous after considering conversation context
   {
     "tool": "ask_clarification",
     "question": "<one concise question in English>",
     "missingField": "recipient" | "amount" | "date" | "action" | "confirmation" | "frequency"
   }

IMPORTANT: If the user says "same amount" or "same person" — look at conversation history to resolve.
If only the recipient is said (e.g. "Rahul ko bhejo") with no amount — use ask_clarification with missingField "amount".
If only the amount is said (e.g. "500 bhejo") with no recipient — use ask_clarification with missingField "recipient".
NUMBER ACCURACY: Parse Hindi number words with extreme care. "do rupaye" = ₹2, "do sau" = ₹200, "bees rupaye" = ₹20. Never round or substitute a nearby number.
Output ONLY valid JSON.`;
}

// ─── Ollama call with retry ───────────────────────────────────────────────────

async function callAgentLLM(
  messages: AgentMessage[],
  contacts: ContactInfo[],
  balance: number,
  attempt = 0
): Promise<ToolCall> {
  const systemPrompt = buildSystemPrompt(contacts, balance);

  const payload = {
    model: OLLAMA_MODEL,
    stream: false,
    options: { temperature: 0.05, num_predict: 350 },
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  console.log("\n===== OLLAMA REQUEST =====");
  console.log("Attempt:", attempt + 1, "| Model:", OLLAMA_MODEL);
  console.log("Last user:", messages[messages.length - 1]?.content);
  console.log("==========================\n");

  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    message?: { content: string };
    error?: string;
  };

  if (data.error) throw new Error(`Ollama error: ${data.error}`);

  const raw = data.message?.content?.trim() ?? "";
  console.log("Ollama raw:", raw.slice(0, 500));

  // Extract JSON block
  const jsonMatch =
    raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw;

  let parsed: ToolCall;
  try {
    parsed = JSON.parse(jsonStr) as ToolCall;
  } catch {
    console.error("JSON parse failed:", jsonStr.slice(0, 300));
    // Retry once
    if (attempt < 1) {
      return callAgentLLM(messages, contacts, balance, attempt + 1);
    }
    return {
      tool: "ask_clarification",
      question: "Sorry, I had trouble understanding. Could you repeat?",
      missingField: "action",
    };
  }

  if (!parsed?.tool) {
    return {
      tool: "ask_clarification",
      question: "I'm not sure what you need. Could you rephrase?",
      missingField: "action",
    };
  }

  return parsed;
}

// ─── Main agent loop ──────────────────────────────────────────────────────────
// This is a single-turn ReAct step. The frontend maintains conversation history
// across turns, so multi-turn context is handled by passing conversationHistory.

async function runAgentLoop(
  transcript: string,
  contacts: ContactInfo[],
  balance: number,
  conversationHistory: AgentMessage[],
  languageCode: string
): Promise<ParsedCommand> {
  const messages: AgentMessage[] = [
    ...conversationHistory,
    { role: "user", content: transcript },
  ];

  // ── Step 1: call LLM ──
  const toolCall = await callAgentLLM(messages, contacts, balance);

  // ── Step 2: post-process contact matching ──
  // Even if Ollama returned a recipient name, verify it against our contact list
  const resolveRecipient = (
    recipientName: string,
    recipientUpiId: string
  ): {
    name: string;
    upiId: string;
    candidates: ContactInfo[];
    resolved: boolean;
  } => {
    // If Ollama gave us a valid UPI ID from the list, trust it
    const byUpi = contacts.find((c) => c.upiId === recipientUpiId);
    if (byUpi) {
      return {
        name: byUpi.name,
        upiId: byUpi.upiId,
        candidates: [],
        resolved: true,
      };
    }

    // Fuzzy match by name
    const { match, candidates } = fuzzyMatchContact(recipientName, contacts);
    if (match) {
      return {
        name: match.name,
        upiId: match.upiId,
        candidates: [],
        resolved: true,
      };
    }

    return {
      name: recipientName,
      upiId: "",
      candidates,
      resolved: false,
    };
  };

  // ── Step 3: build ParsedCommand from tool call ──
  let result: ParsedCommand;

  // Detect language from transcript to respond in user's language
  const detectedLanguage = detectLanguageFromText(transcript) !== "en-IN"
    ? detectLanguageFromText(transcript)
    : languageCode;

  if (toolCall.tool === "execute_payment") {
    const inp = toolCall;
    const resolved = resolveRecipient(inp.recipient, inp.recipientUpiId ?? "");

    if (!resolved.resolved) {
      // Contact not found — ask clarification with suggestions
      const candidateStr = resolved.candidates
        .map((c) => c.name)
        .join(", ");
      const agentReply =
        resolved.candidates.length > 0
          ? buildTTSReply("contact_not_found", detectedLanguage, {
              name: inp.recipient,
              candidates: candidateStr,
            })
          : buildTTSReply("contact_not_found", detectedLanguage, {
              name: inp.recipient,
            });

      result = {
        action: "clarify",
        amount: inp.amount,
        recipient: inp.recipient,
        recipientUpiId: null,
        scheduledDate: inp.scheduledDate ?? null,
        confidence: 0.4,
        rawTranscript: transcript,
        agentReply,
        needsClarification: true,
        clarificationQuestion: agentReply,
        suggestedContacts: resolved.candidates,
        detectedLanguage,
      };
    } else {
      const isSchedule = inp.action === "schedule" || !!inp.scheduledDate;
      const agentReply = buildTTSReply("payment", detectedLanguage, {
        amount: inp.amount,
        name: resolved.name.split(" ")[0],
        date: inp.scheduledDate,
        isSchedule,
      });

      result = {
        action: isSchedule ? "schedule" : "send",
        amount: inp.amount,
        recipient: resolved.name,
        recipientUpiId: resolved.upiId,
        scheduledDate: inp.scheduledDate ?? null,
        scheduledTime: inp.scheduledTime ?? null,
        confidence: inp.confidence ?? 0.9,
        rawTranscript: transcript,
        agentReply,
        needsClarification: false,
        detectedLanguage,
      };
    }
  } else if (toolCall.tool === "setup_mandate") {
    const inp = toolCall;
    const resolved = resolveRecipient(inp.recipient, inp.recipientUpiId ?? "");

    if (!resolved.resolved) {
      const candidateStr = resolved.candidates.map((c) => c.name).join(", ");
      const agentReply = buildTTSReply("contact_not_found", detectedLanguage, {
        name: inp.recipient,
        candidates: candidateStr || undefined,
      });
      result = {
        action: "clarify",
        amount: inp.amount,
        recipient: inp.recipient,
        recipientUpiId: null,
        scheduledDate: null,
        confidence: 0.4,
        rawTranscript: transcript,
        agentReply,
        needsClarification: true,
        clarificationQuestion: agentReply,
        suggestedContacts: resolved.candidates,
        detectedLanguage,
      };
    } else {
      const mandateConfig: MandateConfig = {
        frequency: inp.frequency ?? "monthly",
        startDate: inp.startDate ?? todayStr(),
        endDate: inp.endDate,
        maxAmount: inp.maxAmount ?? inp.amount,
        remark: inp.remark ?? `${inp.frequency ?? "monthly"} payment`,
      };

      const agentReply = buildTTSReply("mandate", detectedLanguage, {
        amount: inp.amount,
        name: resolved.name.split(" ")[0],
        frequency: mandateConfig.frequency,
      });

      result = {
        action: "mandate",
        amount: inp.amount,
        recipient: resolved.name,
        recipientUpiId: resolved.upiId,
        scheduledDate: mandateConfig.startDate,
        mandateConfig,
        confidence: inp.confidence ?? 0.85,
        rawTranscript: transcript,
        agentReply,
        needsClarification: false,
        detectedLanguage,
      };
    }
  } else if (toolCall.tool === "check_balance") {
    result = {
      action: "check_balance",
      amount: null,
      recipient: null,
      recipientUpiId: null,
      scheduledDate: null,
      confidence: 1.0,
      rawTranscript: transcript,
      agentReply: buildTTSReply("balance", detectedLanguage, { amount: balance }),
      needsClarification: false,
      detectedLanguage,
    };
  } else if (toolCall.tool === "get_transaction_history") {
    result = {
      action: "history",
      amount: null,
      recipient: null,
      recipientUpiId: null,
      scheduledDate: null,
      confidence: 1.0,
      rawTranscript: transcript,
      agentReply: buildTTSReply("history", detectedLanguage, {}),
      needsClarification: false,
      detectedLanguage,
    };
  } else if (toolCall.tool === "ask_clarification") {
    const inp = toolCall;
    const agentReply = buildTTSReply("clarify", detectedLanguage, {
      missingField: inp.missingField,
      fallback: inp.question,
    });
    result = {
      action: "clarify",
      amount: null,
      recipient: null,
      recipientUpiId: null,
      scheduledDate: null,
      confidence: 0.5,
      rawTranscript: transcript,
      agentReply,
      needsClarification: true,
      clarificationQuestion: agentReply,
      suggestedContacts: inp.suggestedContacts ?? [],
      detectedLanguage,
    };
  } else {
    result = {
      action: "unknown",
      amount: null,
      recipient: null,
      recipientUpiId: null,
      scheduledDate: null,
      confidence: 0.1,
      rawTranscript: transcript,
      agentReply: buildTTSReply("unknown", detectedLanguage, {}),
      needsClarification: true,
      detectedLanguage,
    };
  }

  // Attach updated conversation history for frontend multi-turn memory
  const updatedHistory: AgentMessage[] = [
    ...messages,
    { role: "assistant", content: result.agentReply },
  ];

  return { ...result, conversationHistory: updatedHistory };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/voice/stt
router.post("/stt", async (req, res) => {
  try {
    const { audio, languageCode, mimeType: rawMime } = req.body;
    if (!audio || !languageCode) {
      res.status(400).json({ error: "Missing audio or languageCode" });
      return;
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const mimeType = ((rawMime as string) || "audio/wav").split(";")[0].trim();
    const ext = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("mp3")
      ? "mp3"
      : "wav";

    const form = new FormData();
    form.append("file", audioBuffer, {
      filename: `audio.${ext}`,
      contentType: mimeType,
    });
    form.append("language_code", languageCode);
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");

    const response = await fetch(`${SARVAM_BASE}/speech-to-text`, {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam STT error:", errText);
      res.status(500).json({ error: errText.slice(0, 200) });
      return;
    }

    const sttData = (await response.json()) as { transcript: string };
    res.json({ transcript: sttData.transcript || "" });
  } catch (err) {
    console.error("STT error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/voice/parse — main agentic endpoint
router.post("/parse", async (req, res) => {
  const {
    transcript,
    contacts = [] as ContactInfo[],
    balance = 24750,
    conversationHistory = [] as AgentMessage[],
    languageCode = "en-IN",
  } = req.body;

  if (!transcript) {
    res.status(400).json({ error: "Missing transcript" });
    return;
  }

  try {
    const result = await runAgentLoop(
      transcript,
      contacts,
      balance,
      conversationHistory,
      languageCode
    );
    res.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Agent parse error:", detail);
    res.status(500).json({
      action: "unknown",
      amount: null,
      recipient: null,
      recipientUpiId: null,
      scheduledDate: null,
      confidence: 0,
      rawTranscript: transcript,
      agentReply: `Agent error: ${detail}`,
      needsClarification: true,
      error: detail,
    } as ParsedCommand);
  }
});

// POST /api/voice/tts
router.post("/tts", async (req, res) => {
  try {
    const { text, languageCode } = req.body;
    if (!text || !languageCode) {
      res.status(400).json({ error: "Missing text or languageCode" });
      return;
    }

    const safeText = String(text).slice(0, 490);

    const response = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [safeText],
        target_language_code: languageCode,
        model: "bulbul:v3",
        speaker: "priya",
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam TTS error:", errText);
      res.status(500).json({ error: "TTS service failed" });
      return;
    }

    const ttsData = (await response.json()) as { audios: string[] };
    res.json({ audio: ttsData.audios?.[0] || "" });
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/voice/translate
router.post("/translate", async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text || !sourceLanguage || !targetLanguage) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const response = await fetch(`${SARVAM_BASE}/translate`, {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLanguage,
        target_language_code: targetLanguage,
        model: "mayura:v1",
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam translate error:", errText);
      res.status(500).json({ error: "Translation service failed" });
      return;
    }

    const translateData = (await response.json()) as {
      translated_text: string;
    };
    res.json({ translatedText: translateData.translated_text || "" });
  } catch (err) {
    console.error("Translate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;