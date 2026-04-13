import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

// Resolved at module load — same logic used throughout the app
const BASE_URL =
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000");

/** POST an event through the backend SSE relay to another profile's tab */
async function broadcastToProfile(toProfileId: string, payload: Record<string, unknown>) {
  if (Platform.OS !== "web") return;
  try {
    await fetch(`${BASE_URL}/api/p2p/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toProfileId, ...payload }),
    });
  } catch {
    // Best-effort — silently ignore network errors
  }
}

// ── Profile ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  name: string;
  upiId: string;
  initials: string;
  color: string;
  baseBalance: number;
};

export const PROFILES: Profile[] = [
  { id: "aditya", name: "Aditya Kumar", upiId: "aditya@upi", initials: "AK", color: "#6366F1", baseBalance: 24750 },
  { id: "rahul",  name: "Rahul Sharma",  upiId: "rahul@upi",  initials: "RS", color: "#2196F3", baseBalance: 18500 },
];

// ── Other types ────────────────────────────────────────────────────────────────

export type Contact = {
  id: string;
  name: string;
  upiId: string;
  avatar: string;
  initials: string;
  color: string;
};

export type Transaction = {
  id: string;
  type: "sent" | "received" | "scheduled";
  amount: number;
  contactId: string;
  contactName: string;
  date: string;
  note?: string;
  category: string;
  intent?: string;
  status: "completed" | "pending" | "failed";
  transactionId: string;
};

export type ScheduledPayment = {
  id: string;
  amount: number;
  contactId: string;
  contactName: string;
  date: string;
  time?: string;
  recurring?: "daily" | "weekly" | "monthly" | null;
  note?: string;
  category?: string;
};

export type PaymentRequest = {
  id: string;
  fromContactId: string;
  fromContactName: string;
  amount: number;
  note?: string;
  date: string;
  status: "pending" | "accepted" | "declined";
};

// ── Mock contacts ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6366F1", "#2196F3", "#FF6D00", "#F59E0B",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export const MOCK_CONTACTS: Contact[] = [
  { id: "0", name: "Aditya Kumar", upiId: "aditya@upi",    avatar: "", initials: "AK", color: "#6366F1" },
  { id: "1", name: "Rahul Sharma",  upiId: "rahul@upi",    avatar: "", initials: "RS", color: "#2196F3" },
  { id: "2", name: "Priya Patel",   upiId: "priya@paytm",  avatar: "", initials: "PP", color: AVATAR_COLORS[1] },
  { id: "3", name: "Ankit Kumar",   upiId: "ankit@gpay",   avatar: "", initials: "AK", color: AVATAR_COLORS[2] },
  { id: "4", name: "Sunita Devi",   upiId: "sunita@upi",   avatar: "", initials: "SD", color: AVATAR_COLORS[3] },
  { id: "5", name: "Vikram Singh",  upiId: "vikram@upi",   avatar: "", initials: "VS", color: AVATAR_COLORS[4] },
  { id: "6", name: "Meera Joshi",   upiId: "meera@okaxis", avatar: "", initials: "MJ", color: AVATAR_COLORS[5] },
  { id: "7", name: "Amit Verma",    upiId: "amit@upi",     avatar: "", initials: "AV", color: AVATAR_COLORS[6] },
  { id: "8", name: "Kavya Nair",    upiId: "kavya@upi",    avatar: "", initials: "KN", color: AVATAR_COLORS[7] },
];

// ── Mock data generators ───────────────────────────────────────────────────────

const CATEGORIES = ["Food", "Transport", "Shopping", "Entertainment", "Utilities", "Others"];

function generateTransactions(excludeUpiId?: string): Transaction[] {
  const txns: Transaction[] = [];
  const now = new Date();
  const usable = MOCK_CONTACTS.filter((c) => c.upiId !== excludeUpiId);
  for (let i = 0; i < 60; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    const contact = usable[Math.floor(Math.random() * usable.length)];
    const isSent = Math.random() > 0.3;
    txns.push({
      id: `txn_${i}`,
      type: isSent ? "sent" : "received",
      amount: Math.floor(Math.random() * 4500) + 50,
      contactId: contact.id,
      contactName: contact.name,
      date: date.toISOString(),
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      status: "completed",
      transactionId: `TXN${Date.now()}${i}`,
      note: isSent ? "Payment" : "Received",
    });
  }
  return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function generateScheduled(): ScheduledPayment[] {
  const now = new Date();
  return [
    {
      id: "sch_1", amount: 2000, contactId: "1", contactName: "Rahul Sharma",
      date: new Date(now.getTime() + 2 * 86400000).toISOString().split("T")[0],
      recurring: "monthly", note: "Monthly rent share",
    },
    {
      id: "sch_2", amount: 500, contactId: "2", contactName: "Priya Patel",
      date: new Date(now.getTime() + 5 * 86400000).toISOString().split("T")[0],
      recurring: null, note: "Lunch split",
    },
    {
      id: "sch_3", amount: 150, contactId: "6", contactName: "Meera Joshi",
      date: new Date(now.getTime() + 1 * 86400000).toISOString().split("T")[0],
      recurring: "weekly", note: "Weekly groceries",
    },
  ];
}

function generateRequests(profileId: string): PaymentRequest[] {
  const now = new Date();
  if (profileId === "aditya") {
    return [
      {
        id: "req_demo_1", fromContactId: "1", fromContactName: "Rahul Sharma",
        amount: 750, note: "Movie tickets",
        date: new Date(now.getTime() - 3600000).toISOString(), status: "pending",
      },
    ];
  }
  if (profileId === "rahul") {
    return [
      {
        id: "req_demo_2", fromContactId: "0", fromContactName: "Aditya Kumar",
        amount: 500, note: "Lunch split",
        date: new Date(now.getTime() - 7200000).toISOString(), status: "pending",
      },
    ];
  }
  return [];
}

// ── Session helpers (per-tab profile, web only) ────────────────────────────────

function getSessionProfileId(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage.getItem("activeProfileId") || "aditya";
  }
  return "aditya";
}

function setSessionProfileId(id: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem("activeProfileId", id);
  }
}

// ── Context type ───────────────────────────────────────────────────────────────

type AppContextType = {
  currentProfile: Profile;
  switchProfile: (id: string) => Promise<void>;
  contacts: Contact[];
  transactions: Transaction[];
  scheduledPayments: ScheduledPayment[];
  paymentRequests: PaymentRequest[];
  balance: number;
  totalSent: number;
  totalReceived: number;
  lastPaymentCategory: string | null;
  balanceVisible: boolean;
  setBalanceVisible: (v: boolean) => void;
  addTransaction: (t: Transaction) => void;
  addScheduledPayment: (s: ScheduledPayment) => void;
  removeScheduledPayment: (id: string) => void;
  respondToRequest: (id: string, accepted: boolean) => void;
  sendPaymentRequest: (contactId: string, amount: number, note?: string) => void;
  language: string;
  setLanguage: (l: string) => void;
  onboardingDone: boolean;
  completeOnboarding: () => void;
  lastExecutedSchedule: { id: string; contactName: string; amount: number } | null;
  clearLastExecutedSchedule: () => void;
  incomingP2PPayment: { sender: string; amount: number } | null;
  clearIncomingP2PPayment: () => void;
};

const AppContext = createContext<AppContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initialProfileId = getSessionProfileId();
  const initialProfile = PROFILES.find((p) => p.id === initialProfileId) ?? PROFILES[0];

  const [currentProfileId, setCurrentProfileId] = useState<string>(initialProfileId);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    generateTransactions(initialProfile.upiId)
  );
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>(generateScheduled);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(() =>
    generateRequests(initialProfileId)
  );
  const [balanceAdjustment, setBalanceAdjustment] = useState(0);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [language, setLanguageState] = useState("en-IN");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [lastExecutedSchedule, setLastExecutedSchedule] = useState<{
    id: string; contactName: string; amount: number;
  } | null>(null);
  const [incomingP2PPayment, setIncomingP2PPayment] = useState<{
    sender: string; amount: number;
  } | null>(null);

  // ── Refs for stale-closure-free access ──────────────────────────────────────
  const scheduledRef = useRef<ScheduledPayment[]>([]);
  const transactionsRef = useRef<Transaction[]>(transactions);
  const balanceAdjRef = useRef(balanceAdjustment);
  const paymentRequestsRef = useRef<PaymentRequest[]>(paymentRequests);
  const currentProfileIdRef = useRef(currentProfileId);
  // Start as true so save effects don't fire before the first async load completes
  const isSwitchingRef = useRef(true);
  // Mutable ref so the scheduler's closed-over tick() always calls the latest addTransaction
  const addTransactionRef = useRef<(t: Transaction) => void>(() => {});

  useEffect(() => { currentProfileIdRef.current = currentProfileId; }, [currentProfileId]);
  useEffect(() => { scheduledRef.current = scheduledPayments; }, [scheduledPayments]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { balanceAdjRef.current = balanceAdjustment; }, [balanceAdjustment]);
  useEffect(() => { paymentRequestsRef.current = paymentRequests; }, [paymentRequests]);

  // ── Load persisted settings (once) ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet(["@language", "@onboarding"]).then((vals) => {
      if (vals[0][1]) setLanguageState(vals[0][1]);
      if (vals[1][1] === "true") setOnboardingDone(true);
    });
  }, []);

  // ── Load per-profile data whenever profile changes ───────────────────────────
  useEffect(() => {
    isSwitchingRef.current = true;
    const id = currentProfileId;
    const profile = PROFILES.find((p) => p.id === id) ?? PROFILES[0];
    AsyncStorage.multiGet([
      `@profile_${id}_txns`,
      `@profile_${id}_balAdj`,
      `@profile_${id}_sched`,
      `@profile_${id}_requests`,
    ]).then(([txnRaw, adjRaw, spRaw, reqRaw]) => {
      if (txnRaw[1]) {
        try { setTransactions(JSON.parse(txnRaw[1])); }
        catch { setTransactions(generateTransactions(profile.upiId)); }
      } else {
        setTransactions(generateTransactions(profile.upiId));
      }
      setBalanceAdjustment(adjRaw[1] ? Number(adjRaw[1]) : 0);
      if (spRaw[1]) {
        try { setScheduledPayments(JSON.parse(spRaw[1])); }
        catch { setScheduledPayments(generateScheduled()); }
      } else {
        setScheduledPayments(generateScheduled());
      }
      if (reqRaw[1]) {
        try { setPaymentRequests(JSON.parse(reqRaw[1])); }
        catch { setPaymentRequests(generateRequests(id)); }
      } else {
        setPaymentRequests(generateRequests(id));
      }
      isSwitchingRef.current = false;
    });
  }, [currentProfileId]);

  // ── Persist per-profile data (guarded during profile switch) ─────────────────
  useEffect(() => {
    if (isSwitchingRef.current) return;
    AsyncStorage.setItem(`@profile_${currentProfileId}_txns`, JSON.stringify(transactions));
  }, [transactions, currentProfileId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    AsyncStorage.setItem(`@profile_${currentProfileId}_balAdj`, String(balanceAdjustment));
  }, [balanceAdjustment, currentProfileId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    AsyncStorage.setItem(`@profile_${currentProfileId}_sched`, JSON.stringify(scheduledPayments));
  }, [scheduledPayments, currentProfileId]);

  useEffect(() => {
    if (isSwitchingRef.current) return;
    AsyncStorage.setItem(`@profile_${currentProfileId}_requests`, JSON.stringify(paymentRequests));
  }, [paymentRequests, currentProfileId]);

  // ── SSE subscription for cross-tab / cross-origin P2P (web only) ────────────
  // Re-subscribes whenever the active profile changes so only events for THIS
  // profile are received. The server-side relay (GET /api/p2p/events/:profileId)
  // routes POST /api/p2p/broadcast messages to the correct SSE connection.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof EventSource === "undefined") return;

    const es = new EventSource(`${BASE_URL}/api/p2p/events/${currentProfileId}`);

    es.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(event.data as string); } catch { return; }
      if (!msg || msg.type === "connected") return;

      if (msg.type === "PAYMENT") {
        const incoming: Transaction = {
          id: `txn_p2p_${Date.now()}`,
          type: "received",
          amount: msg.amount as number,
          contactId: msg.senderContactId as string,
          contactName: msg.senderName as string,
          date: (msg.date as string) || new Date().toISOString(),
          note: (msg.note as string) || "Payment received",
          category: (msg.category as string) || "Others",
          status: "completed",
          transactionId: msg.transactionId as string,
        };
        setTransactions((prev) => [incoming, ...prev]);
        setBalanceAdjustment((prev) => prev + (msg.amount as number));
        setIncomingP2PPayment({ sender: msg.senderName as string, amount: msg.amount as number });
      }

      if (msg.type === "PAYMENT_REQUEST") {
        const req: PaymentRequest = {
          id: msg.requestId as string,
          fromContactId: msg.requesterContactId as string,
          fromContactName: msg.requesterName as string,
          amount: msg.amount as number,
          note: msg.note as string | undefined,
          date: (msg.date as string) || new Date().toISOString(),
          status: "pending",
        };
        setPaymentRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)]);
      }
    };

    return () => { es.close(); };
  }, [currentProfileId]); // Re-subscribe when profile switches

  // ── Scheduled payment executor (every 1s + on mount) ────────────────────────
  // executingIds prevents the same payment from firing twice if ticks overlap
  const executingIds = useRef(new Set<string>()).current;

  useEffect(() => {
    const tick = () => {
      // Don't execute during a profile switch — state is mid-load
      if (isSwitchingRef.current) return;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;

      scheduledRef.current.forEach((s) => {
        const pastDate = s.date < todayStr;
        const todayDue = s.date === todayStr && (!s.time || s.time <= currentTime);
        if (!pastDate && !todayDue) return;

        // Dedup guard — skip if already being processed
        if (executingIds.has(s.id)) return;
        executingIds.add(s.id);

        // Route through addTransaction so SSE broadcast fires for the receiver
        addTransactionRef.current({
          id: `txn_sch_${s.id}_${Date.now()}`,
          type: "sent",
          amount: s.amount,
          contactId: s.contactId,
          contactName: s.contactName,
          date: new Date().toISOString(),
          note: s.note || "Scheduled payment",
          category: s.category ?? "Others",
          status: "completed",
          transactionId: `TXN${Date.now()}`,
        });

        // Remove from scheduled list (also clears the dedup guard entry)
        setScheduledPayments((prev) => {
          executingIds.delete(s.id);
          return prev.filter((p) => p.id !== s.id);
        });

        if (s.recurring) {
          const next = new Date(s.date);
          if (s.recurring === "daily") next.setDate(next.getDate() + 1);
          else if (s.recurring === "weekly") next.setDate(next.getDate() + 7);
          else if (s.recurring === "monthly") next.setMonth(next.getMonth() + 1);
          const nextEntry: ScheduledPayment = {
            ...s,
            id: `sch_rec_${Date.now()}`,
            date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
          };
          setScheduledPayments((prev) => [nextEntry, ...prev]);
        }

        setLastExecutedSchedule({ id: s.id, contactName: s.contactName, amount: s.amount });
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────────

  const currentProfile = useMemo(
    () => PROFILES.find((p) => p.id === currentProfileId) ?? PROFILES[0],
    [currentProfileId]
  );

  const contacts = useMemo(
    () => MOCK_CONTACTS.filter((c) => c.upiId !== currentProfile.upiId),
    [currentProfile]
  );

  const totalSent = useMemo(
    () => transactions.filter((t) => t.type === "sent").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const totalReceived = useMemo(
    () => transactions.filter((t) => t.type === "received").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const lastPaymentCategory = useMemo(
    () => transactions.find((t) => t.type === "sent" || t.type === "received")?.category ?? null,
    [transactions]
  );
  const balance = currentProfile.baseBalance + balanceAdjustment;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const setLanguage = useCallback((l: string) => {
    setLanguageState(l);
    AsyncStorage.setItem("@language", l);
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    AsyncStorage.setItem("@onboarding", "true");
  }, []);

  const addTransaction = useCallback((t: Transaction) => {
    setTransactions((prev) => [t, ...prev]);
    setBalanceAdjustment((prev) =>
      t.type === "sent" ? prev - t.amount : t.type === "received" ? prev + t.amount : prev
    );

    // Relay to recipient tab via backend SSE if they're a known profile
    if (t.type === "sent") {
      const recipientContact = MOCK_CONTACTS.find((c) => c.id === t.contactId);
      const recipientProfile = PROFILES.find(
        (p) => p.upiId === recipientContact?.upiId && p.id !== currentProfileIdRef.current
      );
      if (recipientProfile) {
        const senderProfile = PROFILES.find((p) => p.id === currentProfileIdRef.current)!;
        const senderContact = MOCK_CONTACTS.find((c) => c.upiId === senderProfile.upiId);
        broadcastToProfile(recipientProfile.id, {
          type: "PAYMENT",
          amount: t.amount,
          senderName: senderProfile.name,
          senderContactId: senderContact?.id ?? "0",
          transactionId: t.transactionId,
          date: t.date,
          note: t.note,
          category: t.category,
        });
      }
    }
  }, []);

  // Keep ref in sync on every render so tick() always calls the latest version
  addTransactionRef.current = addTransaction;

  const addScheduledPayment = useCallback((s: ScheduledPayment) => {
    setScheduledPayments((prev) => [s, ...prev]);
  }, []);

  const removeScheduledPayment = useCallback((id: string) => {
    setScheduledPayments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const respondToRequest = useCallback((id: string, accepted: boolean) => {
    setPaymentRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: accepted ? "accepted" : "declined" } : r))
    );
  }, []);

  const sendPaymentRequest = useCallback((contactId: string, amount: number, note?: string) => {
    const contact = MOCK_CONTACTS.find((c) => c.id === contactId);
    if (!contact) return;
    const targetProfile = PROFILES.find(
      (p) => p.upiId === contact.upiId && p.id !== currentProfileIdRef.current
    );
    if (!targetProfile) return;
    const senderProfile = PROFILES.find((p) => p.id === currentProfileIdRef.current)!;
    const senderContact = MOCK_CONTACTS.find((c) => c.upiId === senderProfile.upiId);
    broadcastToProfile(targetProfile.id, {
      type: "PAYMENT_REQUEST",
      requestId: `req_${Date.now()}`,
      requesterName: senderProfile.name,
      requesterContactId: senderContact?.id ?? "0",
      amount,
      note,
      date: new Date().toISOString(),
    });
  }, []);

  const switchProfile = useCallback(async (newId: string) => {
    if (newId === currentProfileIdRef.current) return;
    // Save current profile state before loading new one
    isSwitchingRef.current = true;
    await AsyncStorage.multiSet([
      [`@profile_${currentProfileIdRef.current}_txns`, JSON.stringify(transactionsRef.current)],
      [`@profile_${currentProfileIdRef.current}_balAdj`, String(balanceAdjRef.current)],
      [`@profile_${currentProfileIdRef.current}_sched`, JSON.stringify(scheduledRef.current)],
      [`@profile_${currentProfileIdRef.current}_requests`, JSON.stringify(paymentRequestsRef.current)],
    ]);
    setSessionProfileId(newId);
    setCurrentProfileId(newId);
  }, []);

  const clearLastExecutedSchedule = useCallback(() => setLastExecutedSchedule(null), []);
  const clearIncomingP2PPayment = useCallback(() => setIncomingP2PPayment(null), []);

  return (
    <AppContext.Provider
      value={{
        currentProfile,
        switchProfile,
        contacts,
        transactions,
        scheduledPayments,
        paymentRequests,
        balance,
        totalSent,
        totalReceived,
        lastPaymentCategory,
        balanceVisible,
        setBalanceVisible,
        addTransaction,
        addScheduledPayment,
        removeScheduledPayment,
        respondToRequest,
        sendPaymentRequest,
        language,
        setLanguage,
        onboardingDone,
        completeOnboarding,
        lastExecutedSchedule,
        clearLastExecutedSchedule,
        incomingP2PPayment,
        clearIncomingP2PPayment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
