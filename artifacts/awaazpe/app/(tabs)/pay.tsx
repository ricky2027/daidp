import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useApp } from "@/context/AppContext";

// ── Native audio (iOS / Android via Expo Go) ──────────────────────────────────
import { File } from "expo-file-system";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
} from "expo-audio";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMessage = { role: "user" | "assistant"; content: string };

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
  mandateConfig?: {
    frequency: "daily" | "weekly" | "monthly" | "yearly" | "as_presented";
    startDate: string;
    endDate?: string;
    maxAmount: number;
    remark: string;
  } | null;
  confidence: number;
  rawTranscript: string;
  agentReply: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  conversationHistory?: AgentMessage[];
  suggestedContacts?: { name: string; upiId: string }[];
};

// ─── VAD Config (web only) ────────────────────────────────────────────────────

const VAD_CONFIG = {
  silenceThreshold: 0.015,
  silenceDurationMs: 1800,
  minSpeechDurationMs: 400,
  maxRecordingMs: 30000,
  fftSize: 512,
};

// ─── Waveform bar ─────────────────────────────────────────────────────────────

function WaveformBar({
  index,
  animated,
  level,
}: {
  index: number;
  animated: boolean;
  level: number;
}) {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (animated) {
      const personal = 0.6 + (index % 5) * 0.08;
      const target = Math.max(0.08, Math.min(1, level * personal * 2.5));
      Animated.spring(anim, {
        toValue: target,
        speed: 60,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0.2,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [animated, level]);

  return (
    <Animated.View
      style={{
        width: 4,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        transform: [{ scaleY: anim }],
        height: 44,
      }}
    />
  );
}

// ─── TTS helper (web only) ────────────────────────────────────────────────────

async function playTTS(text: string, language: string): Promise<void> {
  if (Platform.OS !== "web") return;
  try {
    const resp = await fetch(`${BASE_URL}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode: language }),
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as { audio: string };
    if (!data.audio) return;
    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    await audio.play();
  } catch {
    // non-critical
  }
}

// ─── Conversation bubble ──────────────────────────────────────────────────────

function ConversationBubble({
  message,
  isUser,
  colors,
}: {
  message: AgentMessage;
  isUser: boolean;
  colors: ReturnType<typeof import("@/context/ThemeContext").useTheme>["colors"];
}) {
  return (
    <View
      style={[
        bubbleStyles.row,
        isUser ? bubbleStyles.userRow : bubbleStyles.agentRow,
      ]}
    >
      {!isUser && (
        <View
          style={[bubbleStyles.avatar, { backgroundColor: COLORS.primary + "20" }]}
        >
          <Ionicons name="sparkles" size={12} color={COLORS.primary} />
        </View>
      )}
      <View
        style={[
          bubbleStyles.bubble,
          {
            backgroundColor: isUser ? COLORS.primary : colors.card,
            borderColor: isUser ? COLORS.primary : colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: isUser ? "#fff" : colors.text,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: "Inter_400Regular",
          }}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8, gap: 8 },
  userRow: { justifyContent: "flex-end" },
  agentRow: { justifyContent: "flex-start" },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
});

// ─── Suggested contact chips ──────────────────────────────────────────────────

function SuggestedContactChips({
  suggestions,
  contacts,
  onSelect,
  colors,
  actionColor,
}: {
  suggestions: { name: string; upiId: string }[];
  contacts: any[];
  onSelect: (c: any) => void;
  colors: any;
  actionColor: string;
}) {
  if (!suggestions.length) return null;
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          fontFamily: "Inter_500Medium",
          marginBottom: 6,
          letterSpacing: 0.8,
        }}
      >
        DID YOU MEAN?
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {suggestions.map((s, i) => {
          const found = contacts.find(
            (c) =>
              c.upiId === s.upiId ||
              c.name.toLowerCase() === s.name.toLowerCase()
          );
          return (
            <Pressable
              key={i}
              onPress={() => found && onSelect(found)}
              style={{
                backgroundColor: actionColor + "18",
                borderColor: actionColor + "60",
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="person-outline" size={14} color={actionColor} />
              <Text
                style={{
                  color: actionColor,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                }}
              >
                {s.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── AM/PM → 24h time conversion ─────────────────────────────────────────────

function parseTimeTo24h(input: string): string {
  const s = input.trim().toUpperCase();
  // Already 24h HH:MM
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // 12h with AM/PM: "3:30 PM", "11:00 AM", "3 PM"
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ?? "00";
    if (m[3] === "PM" && h !== 12) h += 12;
    if (m[3] === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  return s; // return as-is if unrecognised
}

// ─── Language display helper ──────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  "en-IN": "EN", "hi-IN": "हि", "ta-IN": "த", "te-IN": "తె",
  "bn-IN": "বা", "kn-IN": "ಕ", "mr-IN": "म", "gu-IN": "ગ",
};
const LANG_CYCLE = ["en-IN", "hi-IN", "ta-IN", "te-IN", "bn-IN", "kn-IN", "mr-IN", "gu-IN"];

// ─── Category detection from transcript ───────────────────────────────────────

function detectCategory(transcript: string, note: string): string {
  const text = (transcript + " " + note).toLowerCase();
  if (/zomato|swiggy|food|restaurant|lunch|dinner|breakfast|khana|chai|pizza|burger|cafe|coffee|biryani|dhaba/.test(text)) return "Food";
  if (/uber|ola|auto|taxi|metro|bus|petrol|fuel|rapido|rickshaw|train|flight|cab/.test(text)) return "Transport";
  if (/amazon|flipkart|shop|mall|clothes|kharid|myntra|meesho|shopping/.test(text)) return "Shopping";
  if (/movie|film|netflix|spotify|concert|game|entertainment|show|ott/.test(text)) return "Entertainment";
  if (/electricity|water|gas|bill|internet|wifi|recharge|broadband|utilities/.test(text)) return "Utilities";
  return "Others";
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PayScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { contacts, balance, addTransaction, addScheduledPayment, language, setLanguage } =
    useApp();
  const params = useLocalSearchParams();

  // ── expo-audio hook for native (stable ref — never reassign) ─────────────────
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Mic / VAD state ───────────────────────────────────────────────────────────
  const [micStatus, setMicStatus] = useState<
    "idle" | "requesting" | "listening" | "processing"
  >("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [vadActive, setVadActive] = useState(false);

  // ── Agent state ───────────────────────────────────────────────────────────────
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AgentMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<AgentMessage[]>([]);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<ParsedCommand | null>(null);
  const [suggestedContacts, setSuggestedContacts] = useState<
    { name: string; upiId: string }[]
  >([]);

  // ── Manual form state ─────────────────────────────────────────────────────────
  const [selectedContact, setSelectedContact] = useState<
    (typeof contacts)[0] | null
  >(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // ── Web recording refs ────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadFrameRef = useRef<number>(0);
  const speechStartTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);

  // ── Native recording refs ─────────────────────────────────────────────────────
  const isNativeRecordingRef = useRef(false);
  const nativeMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeAnimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI refs ───────────────────────────────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const micPulse = useRef<Animated.CompositeAnimation | null>(null);

  const scheduleMode = params.scheduleMode === "true";

  // ── One-time audio session setup (required on iOS before recording) ───────────
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(
        (e) => console.warn("setAudioModeAsync:", e)
      );
    }
  }, []);

  // ── Prefill contact from route params ─────────────────────────────────────────
  useEffect(() => {
    if (params.prefillContact) {
      const c = contacts.find((c) => c.id === params.prefillContact);
      if (c) setSelectedContact(c);
    }
  }, [params.prefillContact]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopWebVAD();
      stopWebStream();
      cleanupNative();
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [displayMessages]);

  // ── Mic pulse animation ───────────────────────────────────────────────────────
  const startMicPulse = () => {
    micPulse.current = Animated.loop(
      Animated.sequence([
        Animated.spring(micScaleAnim, {
          toValue: 1.1,
          useNativeDriver: true,
          speed: 16,
        }),
        Animated.spring(micScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 16,
        }),
      ])
    );
    micPulse.current.start();
  };

  const stopMicPulse = () => {
    micPulse.current?.stop();
    Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB PATH — identical to your working web code, untouched
  // ═══════════════════════════════════════════════════════════════════════════

  const stopWebStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopWebVAD = () => {
    cancelAnimationFrame(vadFrameRef.current);
    if (vadTimerRef.current) clearTimeout(vadTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const startVADLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setAudioLevel(Math.min(1, rms / 0.15));

      const now = Date.now();
      const isSpeech = rms > VAD_CONFIG.silenceThreshold;

      if (isSpeech) {
        if (!hasSpeechRef.current) {
          hasSpeechRef.current = true;
          speechStartTimeRef.current = now;
          setVadActive(true);
        }
        silenceStartRef.current = now;
        if (vadTimerRef.current) {
          clearTimeout(vadTimerRef.current);
          vadTimerRef.current = null;
        }
      } else {
        if (hasSpeechRef.current && !vadTimerRef.current) {
          silenceStartRef.current = now;
          vadTimerRef.current = setTimeout(() => {
            const speechDur = now - speechStartTimeRef.current;
            if (speechDur >= VAD_CONFIG.minSpeechDurationMs) {
              finaliseWebRecording();
            } else {
              vadTimerRef.current = null;
              hasSpeechRef.current = false;
              setVadActive(false);
            }
          }, VAD_CONFIG.silenceDurationMs);
        }
      }

      vadFrameRef.current = requestAnimationFrame(tick);
    };

    vadFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const finaliseWebRecording = useCallback(() => {
    stopWebVAD();
    stopMicPulse();
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.onstop = async () => {
      setMicStatus("processing");
      setVadActive(false);
      stopWebStream();

      const mimeType = recorder.mimeType;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      if (blob.size < 800) {
        appendAgentMsg(
          "Recording too short — hold mic and speak, then it will auto-stop."
        );
        setMicStatus("idle");
        return;
      }

      await transcribeWeb(blob, mimeType);
    };

    recorder.stop();
  }, []);

  const startWebListening = async () => {
    setMicStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = VAD_CONFIG.fftSize;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(100);

      hasSpeechRef.current = false;
      silenceStartRef.current = 0;
      vadTimerRef.current = null;

      setMicStatus("listening");
      setVadActive(false);
      setAudioLevel(0);
      startMicPulse();
      startVADLoop();

      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          finaliseWebRecording();
        }
      }, VAD_CONFIG.maxRecordingMs);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: unknown) {
      setMicStatus("idle");
      const domErr = err as DOMException;
      if (domErr.name === "NotAllowedError") {
        Alert.alert(
          "Microphone Blocked",
          "Please allow microphone access and try again."
        );
      } else {
        Alert.alert("Error", "Could not access microphone: " + domErr.message);
      }
    }
  };

  const stopWebListeningManually = () => {
    if (hasSpeechRef.current) {
      finaliseWebRecording();
    } else {
      stopWebVAD();
      stopMicPulse();
      stopWebStream();
      mediaRecorderRef.current?.stop();
      chunksRef.current = [];
      setMicStatus("idle");
      setVadActive(false);
      setAudioLevel(0);
    }
  };

  // Web: blob → base64 → STT
  const transcribeWeb = async (blob: Blob, mimeType: string) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
          ...(bytes.subarray(i, i + chunkSize) as unknown as number[])
        );
      }
      const base64 = btoa(binary);
      await sendToSTT(base64, mimeType);
    } catch (err) {
      appendAgentMsg(
        `STT error: ${err instanceof Error ? err.message : String(err)}`
      );
      setMicStatus("idle");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NATIVE PATH — simple push-to-talk
  // Tap to start → speak → tap again to stop & send to Sarvam.
  // No VAD / metering needed — bypasses all the flaky expo-audio metering bugs.
  // ═══════════════════════════════════════════════════════════════════════════

  const cleanupNative = () => {
    if (nativeMaxTimerRef.current) {
      clearTimeout(nativeMaxTimerRef.current);
      nativeMaxTimerRef.current = null;
    }
    if (nativeAnimIntervalRef.current) {
      clearInterval(nativeAnimIntervalRef.current);
      nativeAnimIntervalRef.current = null;
    }
  };

  // Drive waveform bars with a random signal while recording on native
  // (real-time RMS not available without metering, so we fake it)
  const startNativeFakeWaveform = () => {
    nativeAnimIntervalRef.current = setInterval(() => {
      setAudioLevel(0.2 + Math.random() * 0.7);
    }, 120);
  };

  const stopNativeFakeWaveform = () => {
    if (nativeAnimIntervalRef.current) {
      clearInterval(nativeAnimIntervalRef.current);
      nativeAnimIntervalRef.current = null;
    }
    setAudioLevel(0);
  };

  const startNativeListening = async () => {
    setMicStatus("requesting");

    try {
      // 1. Request permission
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone Blocked",
          "Go to Settings → Privacy → Microphone and allow access for this app."
        );
        setMicStatus("idle");
        return;
      }

      // 2. Configure audio session (must be done before prepareToRecordAsync)
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      // 3. Prepare + start recording
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: false, // not needed — we're push-to-talk
      });
      audioRecorder.record();

      isNativeRecordingRef.current = true;
      setMicStatus("listening");
      setVadActive(true); // show red "active" button state during whole recording
      startMicPulse();
      startNativeFakeWaveform();

      // Hard cap — auto-stop at 30 s
      nativeMaxTimerRef.current = setTimeout(() => {
        if (isNativeRecordingRef.current) finaliseNativeRecording();
      }, VAD_CONFIG.maxRecordingMs);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      console.error("startNativeListening error:", err);
      isNativeRecordingRef.current = false;
      setMicStatus("idle");
      Alert.alert(
        "Recording Error",
        err?.message || "Could not start microphone."
      );
    }
  };

  const finaliseNativeRecording = async () => {
    if (!isNativeRecordingRef.current) return; // guard double-call
    isNativeRecordingRef.current = false;

    cleanupNative();
    stopMicPulse();
    stopNativeFakeWaveform();
    setVadActive(false);
    setMicStatus("processing");

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        appendAgentMsg("No audio captured. Please try again.");
        setMicStatus("idle");
        return;
      }

      // expo-file-system v19 new API
      const file = new File(uri);
      const base64 = await file.base64();

      if (!base64 || base64.length < 200) {
        appendAgentMsg(
          "Recording too short — tap mic, speak your command, then tap again."
        );
        setMicStatus("idle");
        return;
      }

      await sendToSTT(base64, "audio/m4a");
    } catch (err: any) {
      console.error("finaliseNativeRecording error:", err);
      appendAgentMsg("Could not process audio. Please try again.");
      setMicStatus("idle");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED MIC HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMicPress = () => {
    if (micStatus === "processing" || micStatus === "requesting") return;

    if (Platform.OS === "web") {
      micStatus === "listening" ? stopWebListeningManually() : startWebListening();
    } else {
      // Native: tap to start, tap again to stop & send
      micStatus === "listening" ? finaliseNativeRecording() : startNativeListening();
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STT → AGENT PIPELINE (shared by web + native)
  // ═══════════════════════════════════════════════════════════════════════════

  const appendAgentMsg = (content: string) => {
    setDisplayMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const sendToSTT = async (base64: string, mimeType: string) => {
    try {
      const resp = await fetch(`${BASE_URL}/api/voice/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, mimeType, languageCode: language }),
      });
      const sttData = (await resp.json()) as {
        transcript?: string;
        error?: string;
      };

      if (sttData.transcript) {
        await processTranscript(sttData.transcript);
      } else {
        const detail = sttData.error ? ` (${sttData.error})` : "";
        appendAgentMsg(`Could not hear clearly${detail}. Please try again.`);
        setMicStatus("idle");
      }
    } catch (err) {
      appendAgentMsg(
        `STT error: ${err instanceof Error ? err.message : String(err)}`
      );
      setMicStatus("idle");
    }
  };

  const processTranscript = async (text: string) => {
    if (!text.trim()) return;

    setDisplayMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsProcessing(true);
    setAwaitingClarification(false);
    setSuggestedContacts([]);

    try {
      const resp = await fetch(`${BASE_URL}/api/voice/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          contacts: contacts.map((c) => ({ name: c.name, upiId: c.upiId })),
          balance,
          languageCode: language,
          conversationHistory,
        }),
      });

      const data = (await resp.json()) as ParsedCommand;
      setParsed(data);

      setDisplayMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.agentReply },
      ]);

      if (data.conversationHistory) setConversationHistory(data.conversationHistory);

      // Auto-detect language from backend response and update app language
      if ((data as any).detectedLanguage && (data as any).detectedLanguage !== language) {
        setLanguage((data as any).detectedLanguage);
      }

      await playTTS(data.agentReply, (data as any).detectedLanguage || language);

      if (data.needsClarification) {
        setAwaitingClarification(true);
        if (data.suggestedContacts?.length)
          setSuggestedContacts(data.suggestedContacts);
        setTimeout(() => {
          if (micStatus !== "listening") handleMicPress();
        }, 600);
        return;
      }

      if (data.amount) setAmount(String(data.amount));
      if (data.scheduledDate) setScheduleDate(data.scheduledDate);
      if (data.scheduledTime) setScheduleTime(data.scheduledTime);
      if (data.recipient) {
        const found = contacts.find(
          (c) =>
            c.name.toLowerCase().includes(data.recipient!.toLowerCase()) ||
            data.recipient!
              .toLowerCase()
              .includes(c.name.split(" ")[0].toLowerCase())
        );
        if (found) setSelectedContact(found);
      }

      if (
        (data.action === "send" ||
          data.action === "schedule" ||
          data.action === "mandate") &&
        data.confidence >= 0.7
      ) {
        setPendingPayment(data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      appendAgentMsg("Sorry, I had trouble processing that. Please try again.");
      setAwaitingClarification(false);
    } finally {
      setIsProcessing(false);
      setMicStatus("idle");
    }
  };

  // ─── Payment confirm ───────────────────────────────────────────────────────

  const handleConfirmPayment = async () => {
    const payData = pendingPayment;
    const contact =
      selectedContact ||
      (payData?.recipient
        ? contacts.find(
            (c) =>
              c.name
                .toLowerCase()
                .includes(payData.recipient!.toLowerCase()) ||
              payData.recipient!
                .toLowerCase()
                .includes(c.name.split(" ")[0].toLowerCase())
          )
        : null);
    const payAmount = amount || String(payData?.amount || "");

    if (!contact || !payAmount) {
      Alert.alert("Missing Info", "Please select a contact and enter amount");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsPaying(true);

    const action = payData?.action ?? (scheduleMode ? "schedule" : "send");
    const isSchedule = action === "schedule";
    const isMandate = action === "mandate";
    const _tomorrow = new Date();
    _tomorrow.setDate(_tomorrow.getDate() + 1);
    const _tomorrowStr = `${_tomorrow.getFullYear()}-${String(_tomorrow.getMonth() + 1).padStart(2, "0")}-${String(_tomorrow.getDate()).padStart(2, "0")}`;
    const finalDate = scheduleDate || payData?.scheduledDate || _tomorrowStr;
    const recipientFirst = contact.name.split(" ")[0];

    let confirmText = "";
    if (isMandate && payData?.mandateConfig) {
      const mc = payData.mandateConfig;
      confirmText = `Done! UPI Mandate set up for ₹${payAmount} ${mc.frequency} to ${recipientFirst} from ${mc.startDate}.`;
    } else if (isSchedule) {
      confirmText = `Done! Scheduled ₹${payAmount} to ${recipientFirst} for ${finalDate}.`;
    } else {
      confirmText = `Done! ₹${payAmount} sent to ${recipientFirst}.`;
    }

    appendAgentMsg(confirmText);
    await playTTS(confirmText, language);
    setIsPaying(false);
    setPendingPayment(null);

    if (isMandate) {
      router.push({
        pathname: "/receipt",
        params: {
          type: "mandate",
          amount: payAmount,
          contactName: contact.name,
          frequency: payData?.mandateConfig?.frequency ?? "monthly",
          startDate: payData?.mandateConfig?.startDate ?? finalDate,
        },
      });
    } else if (isSchedule) {
      const parsedTime = scheduleTime ? parseTimeTo24h(scheduleTime) : undefined;
      addScheduledPayment({
        id: `sch_${Date.now()}`,
        amount: Number(payAmount),
        contactId: contact.id,
        contactName: contact.name,
        date: finalDate,
        time: parsedTime || undefined,
        note,
        category: detectCategory(payData?.rawTranscript ?? "", note),
      });
      router.push({
        pathname: "/receipt",
        params: {
          type: "scheduled",
          amount: payAmount,
          contactName: contact.name,
          date: finalDate,
        },
      });
    } else {
      const category = detectCategory(payData?.rawTranscript ?? "", note);
      addTransaction({
        id: `txn_${Date.now()}`,
        type: "sent",
        amount: Number(payAmount),
        contactId: contact.id,
        contactName: contact.name,
        date: new Date().toISOString(),
        note: note || "Voice payment",
        category,
        intent: payData?.rawTranscript ? category : undefined,
        status: "completed",
        transactionId: `TXN${Date.now()}`,
      });
      router.push({
        pathname: "/receipt",
        params: {
          type: "sent",
          amount: payAmount,
          contactName: contact.name,
          upiId: contact.upiId,
        },
      });
    }
  };

  const handleReset = () => {
    stopWebVAD();
    stopWebStream();
    stopMicPulse();
    cleanupNative();
    stopNativeFakeWaveform();
    setConversationHistory([]);
    setDisplayMessages([]);
    setParsed(null);
    setPendingPayment(null);
    setAwaitingClarification(false);
    setSuggestedContacts([]);
    setAmount("");
    setScheduleDate("");
    setScheduleTime("");
    setNote("");
    setSelectedContact(null);
    setMicStatus("idle");
    setVadActive(false);
    setAudioLevel(0);
    hasSpeechRef.current = false;
    isNativeRecordingRef.current = false;
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const action = parsed?.action ?? (scheduleMode ? "schedule" : "send");
  const isSchedule = scheduleMode || action === "schedule";
  const isMandate = action === "mandate";
  const actionColor = isMandate
    ? COLORS.warning
    : isSchedule
    ? "#8B5CF6"
    : COLORS.primary;
  const canPay = !!selectedContact && !!amount;
  const hasConversation = displayMessages.length > 0;
  const isListening = micStatus === "listening";

  const micIcon =
    micStatus === "listening"
      ? "stop-circle"
      : micStatus === "processing"
      ? "sync"
      : awaitingClarification
      ? "chatbubble-ellipses"
      : "mic";

  const micLabel =
    micStatus === "requesting"
      ? "Getting mic access…"
      : micStatus === "listening"
      ? Platform.OS === "web"
        ? vadActive
          ? "Listening… (stops automatically)"
          : "Waiting for speech…"
        : "Recording… tap to stop & send"
      : micStatus === "processing"
      ? "Thinking…"
      : awaitingClarification
      ? "Tap mic to answer"
      : "Tap to speak";

  // Web: grey until speech detected, then red. Native: red the whole time.
  const micBg =
    micStatus === "listening"
      ? Platform.OS === "web"
        ? vadActive
          ? COLORS.danger
          : actionColor + "BB"
        : COLORS.danger
      : awaitingClarification
      ? COLORS.warning
      : actionColor;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + (Platform.OS === "web" ? 20 : 10),
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}
            >
              {isMandate ? "Setup Mandate" : isSchedule ? "Schedule Payment" : "Voice Pay"}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary, fontFamily: "Inter_400Regular" },
              ]}
            >
              {awaitingClarification
                ? "Agent needs more info — tap mic to answer"
                : isMandate
                ? 'Try "Setup ₹500 monthly mandate to Rahul"'
                : isSchedule
                ? 'Try "Schedule 500 to Rahul kal"'
                : Platform.OS === "web"
                ? 'Try "Send 500 to Rahul" or "Rahul ko paanch sau bhejo"'
                : "Tap mic → speak your command → tap again to send"}
            </Text>
          </View>
          {/* Language toggle — cycles through supported languages */}
          <Pressable
            onPress={() => {
              const idx = LANG_CYCLE.indexOf(language);
              const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
              setLanguage(next);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.langBtn,
              { backgroundColor: COLORS.primary + "20", borderColor: COLORS.primary + "50" },
            ]}
          >
            <Text style={{ color: COLORS.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {LANG_LABELS[language] ?? "EN"}
            </Text>
          </Pressable>
        </View>

        {/* Mic Section */}
        <View style={styles.micSection}>
          <View style={styles.waveform}>
            {Array.from({ length: 18 }, (_, i) => (
              <WaveformBar
                key={i}
                index={i}
                animated={isListening}
                level={audioLevel}
              />
            ))}
          </View>

          <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              disabled={
                micStatus === "processing" ||
                micStatus === "requesting" ||
                isPaying
              }
              style={[
                styles.micBtn,
                {
                  backgroundColor: micBg,
                  shadowColor: micBg,
                  opacity:
                    micStatus === "processing" || micStatus === "requesting"
                      ? 0.6
                      : 1,
                },
              ]}
            >
              <Ionicons name={micIcon as any} size={40} color="#fff" />
            </Pressable>
          </Animated.View>

          <Text
            style={[
              styles.micHint,
              { color: colors.textSecondary, fontFamily: "Inter_400Regular" },
            ]}
          >
            {micLabel}
          </Text>

          {/* Web: auto-stop hint */}
          {Platform.OS === "web" && isListening && !vadActive && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.primary,
                  opacity: 0.7,
                }}
              />
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                }}
              >
                Auto-stops after 1.8s silence
              </Text>
            </View>
          )}

          {/* Native: tap-to-stop reminder */}
          {Platform.OS !== "web" && isListening && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.danger,
                  opacity: 0.9,
                }}
              />
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                }}
              >
                Tap the mic again when done speaking
              </Text>
            </View>
          )}

          {Platform.OS === "web" && micStatus === "idle" && (
            <Text
              style={[
                styles.micSub,
                { color: colors.textMuted, fontFamily: "Inter_400Regular" },
              ]}
            >
              Sarvam STT · llama3:8b agent · Bulbul TTS
            </Text>
          )}
        </View>

        {/* Conversation */}
        {hasConversation && (
          <View
            style={[styles.conversationCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.conversationHeader}>
              <Text
                style={[
                  styles.conversationLabel,
                  { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
                ]}
              >
                CONVERSATION
              </Text>
              <Pressable onPress={handleReset}>
                <Text
                  style={[
                    styles.resetBtn,
                    { color: COLORS.danger, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Reset
                </Text>
              </Pressable>
            </View>

            {displayMessages.map((msg, i) => (
              <ConversationBubble
                key={i}
                message={msg}
                isUser={msg.role === "user"}
                colors={colors}
              />
            ))}

            {isProcessing && (
              <View style={[bubbleStyles.row, bubbleStyles.agentRow]}>
                <View
                  style={[
                    bubbleStyles.avatar,
                    { backgroundColor: COLORS.primary + "20" },
                  ]}
                >
                  <Ionicons name="sparkles" size={12} color={COLORS.primary} />
                </View>
                <View
                  style={[
                    bubbleStyles.bubble,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                    }}
                  >
                    Thinking…
                  </Text>
                </View>
              </View>
            )}

            {suggestedContacts.length > 0 && (
              <SuggestedContactChips
                suggestions={suggestedContacts}
                contacts={contacts}
                onSelect={(c) => {
                  setSelectedContact(c);
                  setSuggestedContacts([]);
                  setAwaitingClarification(false);
                  processTranscript(`Send to ${c.name}`);
                }}
                colors={colors}
                actionColor={actionColor}
              />
            )}
          </View>
        )}

        {/* Confirmation card */}
        {pendingPayment && !pendingPayment.needsClarification && (
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: colors.card,
                borderColor: actionColor + "50",
              },
            ]}
          >
            <View
              style={[
                styles.confirmHeader,
                { backgroundColor: actionColor + "18" },
              ]}
            >
              <Ionicons
                name={
                  isMandate
                    ? "repeat-outline"
                    : isSchedule
                    ? "calendar-outline"
                    : "checkmark-circle-outline"
                }
                size={18}
                color={actionColor}
              />
              <Text
                style={[
                  styles.confirmTitle,
                  { color: actionColor, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {isMandate
                  ? "Confirm Mandate"
                  : isSchedule
                  ? "Confirm Schedule"
                  : "Confirm Payment"}
              </Text>
            </View>

            {pendingPayment.amount && (
              <View style={styles.confirmRow}>
                <Text
                  style={[
                    styles.confirmKey,
                    { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Amount
                </Text>
                <Text
                  style={[
                    styles.confirmVal,
                    { color: colors.text, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  ₹{pendingPayment.amount.toLocaleString("en-IN")}
                </Text>
              </View>
            )}

            {pendingPayment.recipient && (
              <View style={styles.confirmRow}>
                <Text
                  style={[
                    styles.confirmKey,
                    { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  To
                </Text>
                <Text
                  style={[
                    styles.confirmVal,
                    { color: colors.text, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {pendingPayment.recipient}
                </Text>
              </View>
            )}

            {pendingPayment.scheduledDate && (
              <View style={styles.confirmRow}>
                <Text
                  style={[
                    styles.confirmKey,
                    { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Date
                </Text>
                <Text
                  style={[
                    styles.confirmVal,
                    { color: colors.text, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {pendingPayment.scheduledDate}{scheduleTime ? ` at ${scheduleTime}` : ""}
                </Text>
              </View>
            )}

            {pendingPayment.mandateConfig && (
              <>
                <View style={styles.confirmRow}>
                  <Text
                    style={[
                      styles.confirmKey,
                      {
                        color: colors.textSecondary,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Frequency
                  </Text>
                  <Text
                    style={[
                      styles.confirmVal,
                      { color: colors.text, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {pendingPayment.mandateConfig.frequency
                      .charAt(0)
                      .toUpperCase() +
                      pendingPayment.mandateConfig.frequency.slice(1)}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text
                    style={[
                      styles.confirmKey,
                      {
                        color: colors.textSecondary,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Starts
                  </Text>
                  <Text
                    style={[
                      styles.confirmVal,
                      { color: colors.text, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {pendingPayment.mandateConfig.startDate}
                  </Text>
                </View>
                {pendingPayment.mandateConfig.endDate && (
                  <View style={styles.confirmRow}>
                    <Text
                      style={[
                        styles.confirmKey,
                        {
                          color: colors.textSecondary,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Ends
                    </Text>
                    <Text
                      style={[
                        styles.confirmVal,
                        { color: colors.text, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {pendingPayment.mandateConfig.endDate}
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setPendingPayment(null)}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmPayment}
                disabled={isPaying}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: actionColor, flex: 1 },
                ]}
              >
                <Ionicons
                  name={isMandate ? "repeat" : isSchedule ? "calendar" : "send"}
                  size={16}
                  color="#fff"
                />
                <Text
                  style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}
                >
                  {isPaying
                    ? "Processing…"
                    : isMandate
                    ? "Setup Mandate"
                    : isSchedule
                    ? "Schedule"
                    : "Send Now"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Manual form */}
        <View style={{ marginHorizontal: 20 }}>
          <Text
            style={[
              styles.formSectionLabel,
              { color: colors.textMuted, fontFamily: "Inter_500Medium" },
            ]}
          >
            {hasConversation ? "OR EDIT MANUALLY" : "OR FILL MANUALLY"}
          </Text>

          <Text
            style={[
              styles.fieldLabel,
              { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
            ]}
          >
            Recipient
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
          >
            {contacts.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedContact(c);
                }}
                style={[
                  styles.contactChip,
                  {
                    backgroundColor:
                      selectedContact?.id === c.id ? actionColor : colors.card,
                    borderColor:
                      selectedContact?.id === c.id ? actionColor : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.chipAvatar,
                    {
                      backgroundColor:
                        selectedContact?.id === c.id
                          ? "#fff3"
                          : c.color + "30",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        selectedContact?.id === c.id ? "#fff" : c.color,
                      fontFamily: "Inter_700Bold",
                      fontSize: 12,
                    }}
                  >
                    {c.initials}
                  </Text>
                </View>
                <Text
                  style={{
                    color:
                      selectedContact?.id === c.id ? "#fff" : colors.text,
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                  }}
                >
                  {c.name.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text
            style={[
              styles.fieldLabel,
              { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
            ]}
          >
            Amount (₹)
          </Text>
          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.rupeeSymbol,
                { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              ₹
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.amountInput,
                { color: colors.text, fontFamily: "Inter_700Bold" },
              ]}
            />
          </View>

          {(isSchedule || isMandate) && (
            <>
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.textSecondary,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {isMandate ? "Start Date" : "Scheduled Date"}
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  value={scheduleDate}
                  onChangeText={setScheduleDate}
                  placeholder={
                    new Date(Date.now() + 86400000)
                      .toISOString()
                      .split("T")[0]
                  }
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.noteInput,
                    { color: colors.text, fontFamily: "Inter_400Regular" },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, fontFamily: "Inter_500Medium", marginTop: 12 },
                ]}
              >
                Time (optional)
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  value={scheduleTime}
                  onChangeText={setScheduleTime}
                  onBlur={() => {
                    const converted = parseTimeTo24h(scheduleTime);
                    if (converted) setScheduleTime(converted);
                  }}
                  placeholder="e.g. 3:30 PM or 15:30"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="default"
                  autoCapitalize="characters"
                  style={[
                    styles.noteInput,
                    { color: colors.text, fontFamily: "Inter_400Regular" },
                  ]}
                />
              </View>
            </>
          )}

          <Text
            style={[
              styles.fieldLabel,
              { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
            ]}
          >
            Note (optional)
          </Text>
          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.noteInput,
                { color: colors.text, fontFamily: "Inter_400Regular" },
              ]}
            />
          </View>

          {!pendingPayment && (
            <Pressable
              onPress={handleConfirmPayment}
              disabled={!canPay || isPaying}
              style={({ pressed }) => [
                styles.payBtn,
                {
                  backgroundColor: !canPay ? colors.surface : actionColor,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Ionicons
                name={isMandate ? "repeat" : isSchedule ? "calendar" : "send"}
                size={20}
                color="#fff"
              />
              <Text
                style={[styles.payBtnText, { fontFamily: "Inter_600SemiBold" }]}
              >
                {isPaying
                  ? "Confirming…"
                  : selectedContact && amount
                  ? `${isMandate ? "Setup" : isSchedule ? "Schedule" : "Pay"} ₹${amount} → ${selectedContact.name.split(" ")[0]}`
                  : "Select contact & amount"}
              </Text>
            </Pressable>
          )}

          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: colors.card,
                borderColor: COLORS.primary + "30",
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={COLORS.primary}
            />
            <Text
              style={[
                styles.infoText,
                {
                  color: colors.textSecondary,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {Platform.OS === "web"
                ? 'Speak once — mic auto-stops on silence. Supports Hindi, English, Hinglish. Try: "Setup 1000 rupee monthly mandate to Rahul starting April"'
                : "Tap mic to start, say your command (e.g. \"Send 500 to Rahul\"), then tap again to send to Sarvam."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", minWidth: 38, marginTop: 4 },
  title: { fontSize: 28, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  micSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 4,
    gap: 0,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    gap: 4,
    marginBottom: 16,
  },
  micBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  micHint: { marginTop: 12, fontSize: 13 },
  micSub: { marginTop: 4, fontSize: 11 },
  conversationCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  conversationLabel: { fontSize: 10, letterSpacing: 1.2 },
  resetBtn: { fontSize: 12 },
  confirmCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  confirmTitle: { fontSize: 14 },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmKey: { fontSize: 13 },
  confirmVal: { fontSize: 15 },
  confirmBtns: { flexDirection: "row", gap: 10, padding: 16 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
  },
  formSectionLabel: { fontSize: 10, letterSpacing: 1.2, marginBottom: 14 },
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    gap: 8,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inputRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  rupeeSymbol: { fontSize: 22, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, paddingVertical: 14 },
  noteInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 18,
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  payBtnText: { color: "#fff", fontSize: 16 },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
});