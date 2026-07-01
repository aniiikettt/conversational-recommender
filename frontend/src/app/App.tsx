import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Mic,
  Paperclip,
  ExternalLink,
  GripVertical,
  Download,
  CheckCircle2,
  Loader2,
  X,
  ChevronRight,
  Sparkles,
  Users,
  Briefcase,
  HeartPulse,
  Code2,
  BarChart3,
  Bell,
  ArrowLeftRight,
  Copy,
  FileJson,
  Zap,
  Brain,
  ShieldCheck,
  Globe,
  Clock,
  Star,
  Filter,
  ChevronDown,
  Plus,
  Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TestType = "K" | "P" | "A" | "S" | "B";
type MessageRole = "user" | "assistant";

interface Assessment {
  id: string;
  name: string;
  type: TestType;
  duration: number;
  language: string;
  focusArea: string;
  adaptive: boolean;
  credits: number;
  description: string;
  category: "cognitive" | "personality" | "skills" | "behavioral" | "knowledge";
}

interface Message {
  id: string;
  role: MessageRole;
  content: string | MessageContent;
  timestamp: Date;
}

interface MessageContent {
  text: string;
  table?: TableData;
  highlights?: string[];
  bullets?: string[];
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface ActiveFilter {
  label: string;
  value: string;
  color: string;
}

interface Persona {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  filters: ActiveFilter[];
  prompt: string;
  color: string;
}



// ─── Data ─────────────────────────────────────────────────────────────────────

const ASSESSMENTS: Assessment[] = [
  {
    id: "verify-g",
    name: "Verify G+ Cognitive Ability",
    type: "A",
    duration: 36,
    language: "US English",
    focusArea: "Numerical, Verbal, Inductive Reasoning",
    adaptive: true,
    credits: 3,
    description: "Adaptive multi-measure cognitive battery assessing general mental ability.",
    category: "cognitive",
  },
  {
    id: "opq32",
    name: "OPQ32r Personality",
    type: "P",
    duration: 25,
    language: "US English + 30 languages",
    focusArea: "Relationships, Thinking, Feelings & Emotions",
    adaptive: false,
    credits: 4,
    description: "Industry-leading occupational personality questionnaire with 32 scales.",
    category: "personality",
  },
  {
    id: "mq-motivation",
    name: "MQ Motivation Questionnaire",
    type: "P",
    duration: 20,
    language: "US English, Spanish",
    focusArea: "Drive, Engagement, Resilience",
    adaptive: false,
    credits: 3,
    description: "Measures 18 dimensions of workplace motivation and energy.",
    category: "personality",
  },
  {
    id: "coding-java",
    name: "Coding Pro — Java",
    type: "K",
    duration: 45,
    language: "US English",
    focusArea: "OOP, Data Structures, Algorithms",
    adaptive: false,
    credits: 5,
    description: "Hands-on Java coding assessment with auto-graded test cases.",
    category: "skills",
  },
  {
    id: "coding-rust",
    name: "Coding Pro — Rust",
    type: "K",
    duration: 50,
    language: "US English",
    focusArea: "Memory Safety, Concurrency, Systems",
    adaptive: false,
    credits: 5,
    description: "Advanced Rust systems programming challenge with real-world scenarios.",
    category: "skills",
  },
  {
    id: "verify-verbal",
    name: "Verify Verbal Reasoning",
    type: "A",
    duration: 19,
    language: "US English, Spanish, French",
    focusArea: "Reading Comprehension, Inference",
    adaptive: true,
    credits: 2,
    description: "Assesses ability to evaluate written information and draw conclusions.",
    category: "cognitive",
  },
  {
    id: "verify-numerical",
    name: "Verify Numerical Reasoning",
    type: "A",
    duration: 18,
    language: "US English, Spanish",
    focusArea: "Data Interpretation, Quantitative",
    adaptive: true,
    credits: 2,
    description: "Evaluates ability to make decisions from numerical and statistical data.",
    category: "cognitive",
  },
  {
    id: "workplace-safety",
    name: "Workplace Safety Scenarios",
    type: "S",
    duration: 15,
    language: "US English, Spanish",
    focusArea: "OSHA Compliance, Hazard Recognition",
    adaptive: false,
    credits: 2,
    description: "Situational judgment for safety-critical industrial environments.",
    category: "behavioral",
  },
  {
    id: "customer-service-sj",
    name: "Customer Service SJT",
    type: "S",
    duration: 20,
    language: "US English, Spanish, French",
    focusArea: "Empathy, Conflict Resolution, Speed",
    adaptive: false,
    credits: 2,
    description: "Situational judgment measuring customer-facing behavioral competencies.",
    category: "behavioral",
  },
  {
    id: "hipaa-knowledge",
    name: "HIPAA Compliance Knowledge",
    type: "K",
    duration: 22,
    language: "US English",
    focusArea: "PHI Handling, Privacy Rules, Breach Protocol",
    adaptive: false,
    credits: 3,
    description: "Knowledge test for healthcare admin and clinical support roles.",
    category: "knowledge",
  },
  {
    id: "leadership-360",
    name: "Leadership Impact 360",
    type: "B",
    duration: 30,
    language: "US English",
    focusArea: "Strategic Vision, Team Development, Influence",
    adaptive: false,
    credits: 4,
    description: "Multi-rater behavioral assessment for senior leadership pipelines.",
    category: "behavioral",
  },
  {
    id: "aws-cloud",
    name: "AWS Cloud Practitioner",
    type: "K",
    duration: 35,
    language: "US English",
    focusArea: "EC2, S3, IAM, VPC, Lambda",
    adaptive: false,
    credits: 4,
    description: "Knowledge assessment aligned with AWS CLF-C02 domain objectives.",
    category: "knowledge",
  },
];

const PERSONAS: Persona[] = [
  {
    id: "rust-ic",
    title: "Senior Rust Systems IC",
    subtitle: "IC5 / Principal Engineer",
    icon: <Code2 size={16} />,
    color: "#f59e0b",
    filters: [
      { label: "Seniority", value: "Senior / IC5", color: "#f59e0b" },
      { label: "Domain", value: "Systems", color: "#3b82f6" },
      { label: "Language", value: "US English", color: "#6b7494" },
    ],
    prompt: "I need assessments for a Senior Rust Systems Engineer (IC5). Focus on memory safety, concurrency, systems-level problem solving, and cognitive ability. Must be US English only.",
  },
  {
    id: "contact-center",
    title: "Contact Center Agent",
    subtitle: "High-volume, bilingual",
    icon: <Users size={16} />,
    color: "#10b981",
    filters: [
      { label: "Volume", value: "High-Volume", color: "#10b981" },
      { label: "Languages", value: "EN + ES", color: "#3b82f6" },
      { label: "Focus", value: "Customer Service", color: "#8b5cf6" },
    ],
    prompt: "Looking for assessments for high-volume contact center agent hiring. Bilingual US English and Spanish required. Emphasize customer service judgment, personality fit, and verbal reasoning. Keep total time under 60 minutes.",
  },
  {
    id: "hipaa-admin",
    title: "Bilingual HIPAA Admin",
    subtitle: "Healthcare administration",
    icon: <HeartPulse size={16} />,
    color: "#ec4899",
    filters: [
      { label: "Languages", value: "EN + ES", color: "#3b82f6" },
      { label: "Focus", value: "Safety/Compliance", color: "#ec4899" },
      { label: "Sector", value: "Healthcare", color: "#f59e0b" },
    ],
    prompt: "I'm hiring bilingual (English/Spanish) healthcare administrators who must handle PHI. Need HIPAA compliance knowledge tests, personality screening, and verbal reasoning. Compliance is non-negotiable.",
  },
  {
    id: "vp-sales",
    title: "VP of Sales",
    subtitle: "Enterprise leadership",
    icon: <BarChart3 size={16} />,
    color: "#8b5cf6",
    filters: [
      { label: "Level", value: "VP / Executive", color: "#8b5cf6" },
      { label: "Focus", value: "Leadership", color: "#f59e0b" },
      { label: "Domain", value: "Sales & CX", color: "#10b981" },
    ],
    prompt: "Hiring a VP of Sales for an enterprise SaaS company. Need leadership potential, strategic thinking, motivation drivers, and sales personality alignment. Senior role — quality over speed.",
  },
  {
    id: "devops",
    title: "Senior DevOps / SRE",
    subtitle: "Cloud infrastructure",
    icon: <Briefcase size={16} />,
    color: "#3b82f6",
    filters: [
      { label: "Seniority", value: "Senior", color: "#f59e0b" },
      { label: "Domain", value: "Cloud / Infra", color: "#3b82f6" },
      { label: "Focus", value: "AWS + Docker", color: "#10b981" },
    ],
    prompt: "Need a shortlist for Senior DevOps / Site Reliability Engineer. AWS cloud knowledge, cognitive ability for incident response, and personality for on-call resilience. Docker and infrastructure focus.",
  },
];

const TYPE_META: Record<TestType, { label: string; color: string; bg: string }> = {
  K: { label: "Knowledge", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  P: { label: "Personality", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  A: { label: "Ability", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  S: { label: "Situational", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  B: { label: "Behavioral", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
};

// ─── Simulated AI Responses ────────────────────────────────────────────────────

const getAIResponse = (userMsg: string, currentShortlist: Assessment[]): { message: MessageContent; newShortlist: Assessment[] } => {
  const lower = userMsg.toLowerCase();

  if (lower.includes("rust") || lower.includes("systems engineer") || lower.includes("ic5")) {
    const shortlist = ASSESSMENTS.filter((a) => ["coding-rust", "verify-g", "opq32"].includes(a.id));
    return {
      message: {
        text: "Great — for a **Senior Rust Systems IC** I'd recommend a focused 3-assessment stack. Here's my reasoning:",
        bullets: [
          "Coding Pro — Rust screens for memory safety and concurrency directly in a hands-on format",
          "Verify G+ gives a strong cognitive signal for systems complexity and problem decomposition",
          "OPQ32r rounds out the picture with personality dimensions critical for deep IC work (autonomy, detail orientation)",
        ],
        table: {
          headers: ["Assessment", "Type", "Duration", "Adaptive"],
          rows: shortlist.map((a) => [a.name, a.type, `${a.duration} min`, a.adaptive ? "✓ Yes" : "No"]),
        },
      },
      newShortlist: shortlist,
    };
  }

  if (lower.includes("contact center") || lower.includes("bilingual") && lower.includes("customer")) {
    const shortlist = ASSESSMENTS.filter((a) => ["customer-service-sj", "verify-verbal", "mq-motivation"].includes(a.id));
    return {
      message: {
        text: "For **high-volume bilingual contact center** hiring I'm keeping this lean and efficient — all three assessments are available in Spanish:",
        bullets: [
          "Customer Service SJT directly simulates real call-center scenarios",
          "Verify Verbal Reasoning predicts comprehension speed for scripts and tickets",
          "MQ Motivation measures resilience and drive — crucial for retention in this role",
        ],
        table: {
          headers: ["Assessment", "Language", "Duration", "Focus"],
          rows: shortlist.map((a) => [a.name, a.language.includes("Spanish") ? "EN + ES" : "EN only", `${a.duration} min`, a.focusArea.split(",")[0]]),
        },
      },
      newShortlist: shortlist,
    };
  }

  if (lower.includes("hipaa") || lower.includes("healthcare") || lower.includes("healthcare admin")) {
    const shortlist = ASSESSMENTS.filter((a) => ["hipaa-knowledge", "opq32", "verify-verbal"].includes(a.id));
    return {
      message: {
        text: "For **bilingual HIPAA-compliant admin roles**, compliance knowledge is non-negotiable, so I'm anchoring the shortlist around that:",
        bullets: [
          "HIPAA Compliance Knowledge is the mandatory filter — direct screen for PHI handling rules",
          "Verify Verbal Reasoning (EN + ES available) checks reading precision for policy documents",
          "OPQ32r personality profile helps identify conscientiousness and rule-following orientation",
        ],
        table: {
          headers: ["Assessment", "Required", "Duration", "Language"],
          rows: shortlist.map((a) => [a.name, a.id === "hipaa-knowledge" ? "Mandatory" : "Recommended", `${a.duration} min`, a.language.includes("Spanish") ? "EN + ES" : "EN only"]),
        },
      },
      newShortlist: shortlist,
    };
  }

  if (lower.includes("devops") || lower.includes("sre") || lower.includes("aws") || lower.includes("docker")) {
    const shortlist = ASSESSMENTS.filter((a) => ["aws-cloud", "verify-g", "opq32"].includes(a.id));
    return {
      message: {
        text: "For **Senior DevOps / SRE** I'm recommending a cognitive-heavy stack given the on-call incident response demands:",
        bullets: [
          "AWS Cloud Practitioner verifies foundational cloud infrastructure knowledge",
          "Verify G+ adaptive cognitive battery — high-pressure incident resolution correlates strongly with GMA",
          "OPQ32r surfaces resilience, systematic thinking, and emotional steadiness under pressure",
        ],
        table: {
          headers: ["Assessment", "Type", "Duration", "Credits"],
          rows: shortlist.map((a) => [a.name, a.type, `${a.duration} min`, `${a.credits} cr`]),
        },
      },
      newShortlist: shortlist,
    };
  }

  if (lower.includes("vp") || lower.includes("executive") || lower.includes("leadership") || lower.includes("sales")) {
    const shortlist = ASSESSMENTS.filter((a) => ["leadership-360", "opq32", "mq-motivation"].includes(a.id));
    return {
      message: {
        text: "For a **VP of Sales** search I'm prioritizing leadership bandwidth and motivation drivers over technical screens:",
        bullets: [
          "Leadership Impact 360 is the anchor — multi-rater behavioral assessment designed for senior hires",
          "OPQ32r at the VP level identifies influence style, persuasion, and team development orientation",
          "MQ Motivation reveals what actually energizes this person — critical for revenue role longevity",
        ],
        table: {
          headers: ["Assessment", "Focus", "Duration", "Adaptive"],
          rows: shortlist.map((a) => [a.name, a.focusArea.split(",")[0], `${a.duration} min`, a.adaptive ? "Yes" : "No"]),
        },
      },
      newShortlist: shortlist,
    };
  }

  if (lower.includes("compare") || lower.includes("difference") || lower.includes("vs")) {
    return {
      message: {
        text: "To compare assessments side-by-side, click the **Compare** button on any shortlist card, or select two cards and I can walk you through a parameter-by-parameter breakdown here. What would you like to compare?",
        bullets: ["Duration and time-to-hire impact", "Language availability for your candidate pool", "Adaptive vs. fixed-form scoring methodology"],
      },
      newShortlist: currentShortlist,
    };
  }

  if (lower.includes("remove") || lower.includes("drop") || lower.includes("no personality")) {
    const newShortlist = currentShortlist.filter((a) => a.category !== "personality");
    return {
      message: {
        text: "Removed all **personality assessments** from the shortlist. The remaining stack is purely cognitive and skills-based:",
        bullets: newShortlist.map((a) => `${a.name} — ${a.duration} min`),
      },
      newShortlist,
    };
  }

  if (lower.includes("add") && lower.includes("numerical")) {
    const toAdd = ASSESSMENTS.find((a) => a.id === "verify-numerical");
    if (toAdd && !currentShortlist.find((a) => a.id === toAdd.id)) {
      const newShortlist = [...currentShortlist, toAdd];
      return {
        message: {
          text: "Added **Verify Numerical Reasoning** to the shortlist. This pairs well with the verbal battery for roles that require data interpretation under time pressure.",
          highlights: ["Verify Numerical Reasoning", "18 minutes", "adaptive scoring"],
        },
        newShortlist,
      };
    }
  }

  if (lower.includes("under") && (lower.includes("hour") || lower.includes("60") || lower.includes("45"))) {
    const limit = lower.includes("45") ? 45 : 60;
    const filtered = currentShortlist.filter((a) => a.duration <= limit);
    return {
      message: {
        text: `Trimmed the shortlist to assessments under **${limit} minutes**. ${currentShortlist.length - filtered.length} assessment(s) removed:`,
        bullets: filtered.map((a) => `${a.name} — ${a.duration} min`),
      },
      newShortlist: filtered,
    };
  }

  return {
    message: {
      text: "I can help you build a tailored assessment shortlist. Try describing the role — include seniority level, required languages, and any domain focus areas. Or select a **Preset Persona** from the left panel to start with a pre-configured stack.",
      bullets: [
        "Describe the role: \"Senior backend engineer, US-based, cognitive + coding assessment\"",
        "Set constraints: \"All assessments must be available in Spanish\"",
        "Compare options: \"Compare OPQ32r and MQ Motivation for retention risk\"",
      ],
    },
    newShortlist: currentShortlist,
  };
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-emerald-500/60"
          style={{
            animation: `bounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function TypeBadge({ type }: { type: TestType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono tracking-wider"
      style={{ color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.color}30` }}
    >
      {type}
    </span>
  );
}

function RichMessage({ content }: { content: string | MessageContent }) {
  const renderText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="text-white font-semibold">
          {part}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (typeof content === "string") {
    const lines = content.split("\n");
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <ul key={idx} className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
                <li>{renderText(trimmed.substring(2))}</li>
              </ul>
            );
          }
          if (!trimmed) return <div key={idx} className="h-2" />;
          return (
            <p key={idx} className="text-sm leading-relaxed text-foreground/90">
              {renderText(line)}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {content.text && (
        <p className="text-sm leading-relaxed text-foreground/90">{renderText(content.text)}</p>
      )}
      {content.bullets && (
        <ul className="space-y-1.5">
          {content.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
              <span>{renderText(b)}</span>
            </li>
          ))}
        </ul>
      )}
      {content.highlights && (
        <div className="flex flex-wrap gap-2">
          {content.highlights.map((h, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-md text-xs font-medium"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              {h}
            </span>
          ))}
        </div>
      )}
      {content.table && (
        <div className="overflow-x-auto rounded-lg border border-white/8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {content.table.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.table.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2.5 text-foreground/80">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShortlistCard({
  assessment,
  index,
  onRemove,
  onCompare,
  isCompareSelected,
}: {
  assessment: Assessment;
  index: number;
  onRemove: (id: string) => void;
  onCompare: (a: Assessment) => void;
  isCompareSelected: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const cat = assessment.category;
  const accentColor =
    cat === "cognitive" ? "#3b82f6" : cat === "personality" ? "#8b5cf6" : cat === "behavioral" ? "#10b981" : cat === "knowledge" ? "#f59e0b" : "#ec4899";

  return (
    <div
      className="group relative rounded-xl p-4 transition-all duration-200 cursor-default"
      style={{
        background: isCompareSelected
          ? "rgba(16,185,129,0.08)"
          : hovered
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.025)",
        border: isCompareSelected
          ? "1px solid rgba(16,185,129,0.35)"
          : hovered
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isCompareSelected ? "0 0 0 1px rgba(16,185,129,0.2)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
        style={{ background: accentColor, opacity: 0.6 }}
      />

      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground/40 text-xs font-mono shrink-0">#{String(index + 1).padStart(2, "0")}</span>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
          <GripVertical size={12} className="text-muted-foreground/30 shrink-0 cursor-grab" />
        </div>
        <button
          onClick={() => onRemove(assessment.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
        >
          <X size={12} />
        </button>
      </div>

      <div className="pl-3 mt-2">
        <h4 className="text-sm font-semibold text-foreground leading-snug mb-2.5" style={{ fontFamily: "Outfit, sans-serif" }}>
          {assessment.name}
        </h4>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <TypeBadge type={assessment.type} />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Clock size={9} />
            {assessment.duration} min
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Globe size={9} />
            {assessment.language.split(",")[0]}
          </span>
          {assessment.adaptive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
              <Zap size={9} />
              Adaptive
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed mb-3 line-clamp-2">{assessment.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={() => onCompare(assessment)}
            className="text-[11px] font-medium transition-colors"
            style={{ color: isCompareSelected ? "#10b981" : accentColor, opacity: 0.8 }}
          >
            {isCompareSelected ? "✓ In Compare" : "Compare"}
          </button>
          <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors group/link">
            View Catalog
            <ExternalLink size={9} className="group-hover/link:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareModal({
  items,
  onClose,
}: {
  items: [Assessment, Assessment];
  onClose: () => void;
}) {
  const [a, b] = items;

  const rows: { label: string; icon: React.ReactNode; aVal: string; bVal: string }[] = [
    { label: "Test Type", icon: <Filter size={13} />, aVal: `${a.type} — ${TYPE_META[a.type].label}`, bVal: `${b.type} — ${TYPE_META[b.type].label}` },
    { label: "Duration", icon: <Clock size={13} />, aVal: `${a.duration} min`, bVal: `${b.duration} min` },
    { label: "Focus Area", icon: <Brain size={13} />, aVal: a.focusArea, bVal: b.focusArea },
    { label: "Language", icon: <Globe size={13} />, aVal: a.language, bVal: b.language },
    { label: "Adaptive", icon: <Zap size={13} />, aVal: a.adaptive ? "Yes" : "No", bVal: b.adaptive ? "Yes" : "No" },
    { label: "Credits", icon: <Star size={13} />, aVal: `${a.credits} credits`, bVal: `${b.credits} credits` },
    { label: "Category", icon: <BarChart3 size={13} />, aVal: a.category, bVal: b.category },
    { label: "Description", icon: <ShieldCheck size={13} />, aVal: a.description, bVal: b.description },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(13,17,30,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.1)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-emerald-500" />
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Side-by-Side Comparison
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-[1fr,1fr] gap-0 border-b border-white/8">
          {[a, b].map((item, idx) => (
            <div key={idx} className={`px-6 py-4 ${idx === 0 ? "border-r border-white/8" : ""}`} style={{ background: idx === 0 ? "rgba(59,130,246,0.04)" : "rgba(139,92,246,0.04)" }}>
              <TypeBadge type={item.type} />
              <h4 className="mt-2 font-semibold text-foreground text-sm leading-snug" style={{ fontFamily: "Outfit, sans-serif" }}>
                {item.name}
              </h4>
            </div>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-[140px,1fr,1fr] border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
              <div className="flex items-center gap-2 px-6 py-3 text-xs text-muted-foreground font-medium border-r border-white/8">
                <span className="text-muted-foreground/50">{row.icon}</span>
                {row.label}
              </div>
              <div className="px-6 py-3 text-sm text-foreground/80 border-r border-white/8">{row.aVal}</div>
              <div className="px-6 py-3 text-sm text-foreground/80">{row.bVal}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm"
      style={{
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.25)",
        color: "#f59e0b",
        animation: "slideDown 0.25s ease",
      }}
    >
      <Bell size={14} />
      <span className="flex-1 text-[13px]">{message}</span>
      <button onClick={onDismiss} className="hover:opacity-70 transition-opacity">
        <X size={13} />
      </button>
      <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: {
        text: "Hello! I'm your **SHL Assessment Advisor**. I can help you select, compare, and build a shortlist of pre-employment assessments tailored to any role. To get started:",
        bullets: [
          "Select a Preset Persona on the left to auto-load a curated shortlist",
          "Describe your role: seniority level, domain, language requirements, and time constraints",
          "Ask me to compare specific assessments or explain the differences between test types",
        ],
      },
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [shortlist, setShortlist] = useState<Assessment[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [compareItems, setCompareItems] = useState<Assessment[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [shortlistStatus, setShortlistStatus] = useState<"gathering" | "confirmed">("gathering");
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsTyping(true);
      setShortlistStatus("gathering");

      try {
        // Construct message history in backend format
        const allHistory = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.text
        }));
        // Truncate to last 8 turns to respect the problem statement 8-turn cap
        const currentHistory = allHistory.slice(-8);

        const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        let response: Response;
        try {
          response = await fetch(`${apiBase}/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ messages: currentHistory }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new Error("HTTP error: " + response.status);
        }

        const data = await response.json();

        // Map backend recommendations back to the frontend's static ASSESSMENTS
        const newShortlist: Assessment[] = [];
        if (data.recommendations && data.recommendations.length > 0) {
          data.recommendations.forEach((rec: any) => {
            const match = ASSESSMENTS.find(
              (a) => a.name.toLowerCase() === rec.name.toLowerCase() ||
                     rec.url.toLowerCase().includes(a.id.toLowerCase())
            );
            if (match) {
              newShortlist.push(match);
            } else {
              // Dynamically build metadata if not in static list
              newShortlist.push({
                id: rec.url.split("/").filter(Boolean).pop() || crypto.randomUUID(),
                name: rec.name,
                type: rec.test_type,
                duration: 15,
                language: "US English",
                focusArea: rec.test_type === "P" ? "Personality" : "Skills",
                adaptive: false,
                credits: 1,
                description: "",
                category: rec.test_type === "P" ? "personality" : "skills"
              });
            }
          });
        }

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);

        const removed = shortlist.filter((a) => !newShortlist.find((b) => b.id === a.id));
        const added = newShortlist.filter((a) => !shortlist.find((b) => b.id === a.id));
        if (removed.length > 0 || added.length > 0) {
          const parts: string[] = [];
          if (removed.length) parts.push(`${removed.map((a) => a.name.split(" ")[0]).join(", ")} removed`);
          if (added.length) parts.push(`${added.map((a) => a.name.split(" ")[0]).join(", ")} added`);
          setNotification("Shortlist updated — " + parts.join("; "));
        }
        
        setShortlist(newShortlist);
        if (newShortlist.length > 0 || data.end_of_conversation) {
          setShortlistStatus("confirmed");
        } else {
          setShortlistStatus("gathering");
        }

      } catch (error) {
        console.error("Backend offline or failed, executing simulated fallback:", error);
        const { message, newShortlist } = getAIResponse(text, shortlist);
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        setShortlist(newShortlist);
        if (newShortlist.length > 0) setShortlistStatus("confirmed");
      }
    },
    [messages, shortlist]
  );

  const handlePersona = (persona: Persona) => {
    setActivePersona(persona.id);
    setActiveFilters(persona.filters);
    sendMessage(persona.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleRemoveFromShortlist = (id: string) => {
    const removed = shortlist.find((a) => a.id === id);
    setShortlist((prev) => prev.filter((a) => a.id !== id));
    setCompareItems((prev) => prev.filter((a) => a.id !== id));
    if (removed) setNotification(`${removed.name} removed from shortlist`);
  };

  const handleCompareToggle = (assessment: Assessment) => {
    setCompareItems((prev) => {
      if (prev.find((a) => a.id === assessment.id)) {
        return prev.filter((a) => a.id !== assessment.id);
      }
      if (prev.length >= 2) {
        return [prev[1], assessment];
      }
      const next = [...prev, assessment];
      if (next.length === 2) {
        setTimeout(() => setShowCompare(true), 100);
      }
      return next;
    });
  };

  const handleExport = async (format: "json" | "clipboard") => {
    const data = shortlist.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      duration: a.duration,
      language: a.language,
      adaptive: a.adaptive,
      credits: a.credits,
    }));
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shl-shortlist.json";
      link.click();
    } else {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setNotification("Shortlist copied to clipboard");
      } catch {
        // Fallback for non-HTTPS contexts
        const ta = document.createElement('textarea');
        ta.value = JSON.stringify(data, null, 2);
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setNotification("Shortlist copied to clipboard");
      }
    }
    setExportMenuOpen(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: "#0b0f19", fontFamily: "Inter, sans-serif" }}>
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #10b981, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }} />
        <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full opacity-[0.025]" style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }} />
      </div>

      {/* Top Nav */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(11,15,25,0.9)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-bold text-foreground text-base" style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "-0.01em" }}>
              SHL<span className="text-emerald-500"> Advisor</span>
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-xs text-muted-foreground">Assessment Recommender</span>
        </div>

        <div className="flex items-center gap-3">
          {notification && (
            <NotificationBanner message={notification} onDismiss={() => setNotification(null)} />
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AI Ready
          </div>
        </div>
      </header>

      {/* Main 3-column grid */}
      <div className="relative flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "280px 1fr 360px" }}>

        {/* ── Left Sidebar ── */}
        <aside
          className="flex flex-col overflow-hidden"
          style={{
            borderRight: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(11,14,24,0.6)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="px-4 pt-5 pb-3 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-3">Preset Personas</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin">
            {PERSONAS.map((persona) => (
              <button
                key={persona.id}
                onClick={() => handlePersona(persona)}
                className="w-full text-left p-3 rounded-xl transition-all duration-200 group"
                style={{
                  background: activePersona === persona.id ? `rgba(16,185,129,0.08)` : "rgba(255,255,255,0.025)",
                  border: activePersona === persona.id ? `1px solid rgba(16,185,129,0.3)` : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${persona.color}18`, color: persona.color }}
                    >
                      {persona.icon}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground/90 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {persona.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 leading-tight mt-0.5">{persona.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 mt-0.5 shrink-0 transition-colors" />
                </div>
              </button>
            ))}
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="px-4 pt-3 pb-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2.5">Active Filters</p>
              <div className="flex flex-wrap gap-1.5">
                {activeFilters.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
                    style={{ background: `${f.color}12`, color: f.color, border: `1px solid ${f.color}25` }}
                  >
                    <span className="opacity-60">{f.label}:</span> {f.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Center Chat ── */}
        <main className="flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}
                  >
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                  style={
                    msg.role === "user"
                      ? { background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.2)" }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          backdropFilter: "blur(12px)",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                        }
                  }
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content as string}</p>
                  ) : (
                    <RichMessage content={msg.content} />
                  )}
                  <p
                    className="text-[10px] mt-2 opacity-40"
                    style={{ color: msg.role === "user" ? "#fff" : undefined }}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div
                  className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}
                >
                  <Loader2 size={14} className="text-white animate-spin" />
                </div>
                <div
                  className="rounded-2xl rounded-tl-sm"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(11,15,25,0.8)", backdropFilter: "blur(20px)" }}
          >
            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 0 0 0 transparent",
              }}
            >
              <button 
                className="p-1.5 rounded-lg transition-colors text-muted-foreground/30 cursor-not-allowed shrink-0 mb-0.5"
                title="File upload coming soon"
                disabled
              >
                <Paperclip size={16} />
              </button>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the role, set constraints, or ask me to compare assessments..."
                rows={1}
                className="flex-1 bg-transparent text-foreground/90 placeholder:text-muted-foreground/40 text-sm resize-none outline-none leading-relaxed"
                style={{ maxHeight: "140px", minHeight: "24px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
              <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
                <button 
                  className="p-1.5 rounded-lg transition-colors text-muted-foreground/30 cursor-not-allowed"
                  title="Voice input coming soon"
                  disabled
                >
                  <Mic size={16} />
                </button>
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  className="p-2 rounded-xl transition-all duration-200 disabled:opacity-30"
                  style={{
                    background: inputValue.trim() && !isTyping ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    boxShadow: inputValue.trim() && !isTyping ? "0 4px 12px rgba(16,185,129,0.3)" : "none",
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/30 text-center mt-2">
              Press Enter to send · Shift+Enter for new line · Upload a Job Description with the attachment icon
            </p>
          </div>
        </main>

        {/* ── Right Shortlist Panel ── */}
        <aside
          className="flex flex-col overflow-hidden"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(11,14,24,0.7)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Panel Header */}
          <div
            className="px-5 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Shortlist
                </h3>
                {shortlist.length > 0 && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
                  >
                    {shortlist.length}
                  </span>
                )}
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={
                  shortlistStatus === "confirmed"
                    ? { background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }
                    : { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }
                }
              >
                {shortlistStatus === "confirmed" ? (
                  <><CheckCircle2 size={10} /> Confirmed</>
                ) : (
                  <><Loader2 size={10} className="animate-spin" /> Gathering Context</>
                )}
              </div>
            </div>

            {compareItems.length > 0 && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <div className="flex items-center gap-1.5 text-blue-400">
                  <ArrowLeftRight size={11} />
                  <span>{compareItems.length}/2 selected for compare</span>
                </div>
                {compareItems.length === 2 && (
                  <button
                    onClick={() => setShowCompare(true)}
                    className="text-blue-400 font-semibold hover:text-blue-300 transition-colors"
                  >
                    Compare →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {shortlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <BarChart3 size={20} className="text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/50" style={{ fontFamily: "Outfit, sans-serif" }}>No assessments yet</p>
                  <p className="text-xs text-muted-foreground/40 mt-1 leading-relaxed">Select a persona or describe a role to generate your first shortlist</p>
                </div>
              </div>
            ) : (
              shortlist.map((a, i) => (
                <ShortlistCard
                  key={a.id}
                  assessment={a}
                  index={i}
                  onRemove={handleRemoveFromShortlist}
                  onCompare={handleCompareToggle}
                  isCompareSelected={!!compareItems.find((c) => c.id === a.id)}
                />
              ))
            )}
          </div>

          {/* Panel Footer */}
          {shortlist.length > 0 && (
            <div
              className="px-4 py-4 shrink-0 space-y-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-1">
                <span>{shortlist.length} assessment{shortlist.length !== 1 ? "s" : ""}</span>
                <span>{shortlist.reduce((s, a) => s + a.duration, 0)} min total · {shortlist.reduce((s, a) => s + a.credits, 0)} credits</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    boxShadow: "0 4px 16px rgba(16,185,129,0.25)",
                  }}
                >
                  <Download size={14} />
                  Export Shortlist
                  {exportMenuOpen ? <Minus size={12} /> : <ChevronDown size={12} />}
                </button>

                {exportMenuOpen && (
                  <div
                    className="absolute bottom-full mb-2 left-0 right-0 rounded-xl overflow-hidden"
                    style={{
                      background: "rgba(16,20,35,0.98)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                    }}
                  >
                    <button
                      onClick={() => handleExport("json")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground/80 hover:bg-white/5 hover:text-foreground transition-colors text-left"
                    >
                      <FileJson size={15} className="text-emerald-500" />
                      Download as JSON
                    </button>
                    <div className="border-t border-white/6" />
                    <button
                      onClick={() => handleExport("clipboard")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground/80 hover:bg-white/5 hover:text-foreground transition-colors text-left"
                    >
                      <Copy size={15} className="text-blue-400" />
                      Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Compare Modal */}
      {showCompare && compareItems.length === 2 && (
        <CompareModal
          items={compareItems as [Assessment, Assessment]}
          onClose={() => {
            setShowCompare(false);
            setCompareItems([]);
          }}
        />
      )}
    </div>
  );
}
