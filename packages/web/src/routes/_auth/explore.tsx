import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  MessageSquare,
  Code2,
  Search,
  Lightbulb,
  Palette,
  BarChart3,
  ArrowRight,
  Sparkles,
  Bot,
  Star,
  FileText,
  BookOpen,
  Mail,
  PenTool,
  Database,
  Terminal,
  Briefcase,
  GraduationCap,
  Paintbrush,
  Presentation,
  Globe,
  Shield,
  Layers,
  Megaphone,
  TrendingUp,
  FileSpreadsheet,
  LayoutDashboard,
  Clock,
  Scale,
  Pencil,
  TestTube,
  Zap,
  Receipt,
  Target,
  Headphones,
  UserPlus,
  Workflow,
  FolderOpen,
  Blocks,
  ClipboardCheck,
  Award,
  GitBranch,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { TemplateInputDialog } from "../../components/explore/TemplateInputDialog";
import { api } from "../../lib/api";
import { setPendingFiles } from "../../lib/pending-files";
import { getAgentColor, getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";

export const Route = createFileRoute("/_auth/explore")({
  component: ExplorePage,
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Category = "all" | "agents" | "general" | "business" | "productivity" | "code" | "design" | "research" | "creative" | "analysis" | "education";

type TemplateInputType = "text" | "textarea" | "file";

export interface TemplateInput {
  id: string;
  type: TemplateInputType;
  label: string;
  placeholder: string;
  required: boolean;
  accept?: string;
}

export interface SampleConversation {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, "all" | "agents">;
  tags: string[];
  starterMessage: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  inputs?: TemplateInput[];
}

const categories: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Compass },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "general", label: "General", icon: MessageSquare },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "productivity", label: "Productivity", icon: ClipboardCheck },
  { id: "code", label: "Code", icon: Code2 },
  { id: "design", label: "Design", icon: Paintbrush },
  { id: "research", label: "Research", icon: Search },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "education", label: "Education", icon: GraduationCap },
];

const sampleConversations: SampleConversation[] = [
  // General
  {
    id: "explain-concept",
    title: "Explain a Technical Concept",
    description:
      "Get a layered explanation that builds from fundamentals to advanced details, with real-world analogies.",
    category: "general",
    tags: ["learning", "explanation"],
    starterMessage:
      "Explain {{topic}} in a layered way. Start with the high-level intuition, then go deeper into how it actually works under the hood. Use real-world analogies where they help.",
    icon: Lightbulb,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "topic",
        type: "text",
        label: "What topic do you want explained?",
        placeholder: "e.g. how TLS/SSL encryption works, how garbage collection works, how DNS resolution works...",
        required: true,
      },
    ],
  },
  {
    id: "meeting-summary",
    title: "Extract Action Items from Notes",
    description:
      "Turn messy meeting notes or a brain dump into structured decisions, action items, and next steps.",
    category: "general",
    tags: ["productivity", "summary"],
    starterMessage:
      "Extract decisions, action items (with owners if mentioned), and open questions from these meeting notes. Flag anything that seems unresolved or contradictory.\n\n{{notes}}",
    icon: FileText,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "notes",
        type: "textarea",
        label: "Meeting notes or transcript",
        placeholder: "Paste your raw meeting notes, transcript, or brain dump here...",
        required: true,
      },
      {
        id: "notes_file",
        type: "file",
        label: "Or upload a document",
        placeholder: "TXT, MD, DOCX, PDF...",
        required: false,
        accept: ".txt,.md,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
      },
    ],
  },
  {
    id: "brainstorm-solutions",
    title: "Brainstorm Solutions",
    description:
      "Generate diverse ideas for a specific problem, with trade-offs for each approach.",
    category: "general",
    tags: ["brainstorm", "ideas"],
    starterMessage:
      "I need help brainstorming solutions for the following problem:\n\n{{problem}}\n\nGive me 8 concrete approaches ranked by impact-to-effort ratio, with trade-offs for each.",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "problem",
        type: "textarea",
        label: "What problem do you need solutions for?",
        placeholder: "e.g. Our CI/CD pipeline takes 45 minutes and we need it under 15, our onboarding flow has a 60% drop-off rate, we're running out of database storage...",
        required: true,
      },
    ],
  },

  // Code
  {
    id: "code-review",
    title: "Code Review",
    description:
      "Get a thorough review covering bugs, security, performance, and maintainability.",
    category: "code",
    tags: ["review", "quality"],
    starterMessage:
      "Review this code for bugs, security issues, performance problems, and readability. Prioritize findings by severity and provide a corrected version for anything critical.\n\n```\n{{code}}\n```",
    icon: Code2,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "code",
        type: "textarea",
        label: "Code to review",
        placeholder: "Paste your code here...",
        required: true,
      },
      {
        id: "code_file",
        type: "file",
        label: "Or upload a source file",
        placeholder: ".ts, .py, .go, .rs, .java, ...",
        required: false,
        accept: "text/*,application/json,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php,.swift,.kt",
      },
    ],
  },
  {
    id: "debug-error",
    title: "Debug an Error",
    description:
      "Paste an error message or describe unexpected behavior and get a root cause analysis with fix.",
    category: "code",
    tags: ["debug", "troubleshoot"],
    starterMessage:
      "I'm getting this error and I can't figure out the root cause. Walk me through what's happening, why it's failing, and how to fix it.\n\nError:\n```\n{{error}}\n```\n\nRelevant code (if applicable):\n```\n{{context_code}}\n```",
    icon: Terminal,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "error",
        type: "textarea",
        label: "Error message or stack trace",
        placeholder: "Paste the full error message or stack trace...",
        required: true,
      },
      {
        id: "context_code",
        type: "textarea",
        label: "Relevant code (optional)",
        placeholder: "Paste the code that's causing the error...",
        required: false,
      },
    ],
  },
  {
    id: "system-design",
    title: "System Design",
    description:
      "Get a technical architecture with component diagrams, data flow, and technology choices.",
    category: "code",
    tags: ["architecture", "design"],
    starterMessage:
      "Design a system for the following:\n\n{{system}}\n\nCover the architecture, data model, technology choices, and how it scales.",
    icon: Database,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "system",
        type: "textarea",
        label: "What system do you want designed?",
        placeholder: "e.g. A real-time notification system for a SaaS app with 100k daily active users, supporting push notifications, in-app, and email digests...",
        required: true,
      },
    ],
  },
  {
    id: "write-script",
    title: "Write a Script",
    description:
      "Describe what you need automated and get a working, well-documented script.",
    category: "code",
    tags: ["automation", "script"],
    starterMessage:
      "Write a script for the following:\n\n{{task}}\n\nInclude logging, error handling, and clear comments. Make it production-ready.",
    icon: Terminal,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "task",
        type: "textarea",
        label: "What do you need the script to do?",
        placeholder: "e.g. Monitor a directory for new CSV files, validate their schema, clean the data, and load them into a SQLite database...",
        required: true,
      },
    ],
  },

  // Research
  {
    id: "compare-options",
    title: "Compare Technologies",
    description:
      "Get a structured side-by-side comparison of tools, frameworks, or approaches to make a decision.",
    category: "research",
    tags: ["comparison", "decision"],
    starterMessage:
      "Help me compare the following:\n\n{{comparison}}\n\nEvaluate key dimensions like performance, developer experience, ecosystem maturity, cost, and long-term maintainability. Present as a comparison matrix and recommend one with clear reasoning.",
    icon: Search,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "comparison",
        type: "textarea",
        label: "What do you want to compare?",
        placeholder: "e.g. React Native vs Flutter vs native Swift/Kotlin for a mobile app. Our team knows TypeScript well. We need offline support and push notifications...",
        required: true,
      },
    ],
  },
  {
    id: "research-topic",
    title: "Research a Topic",
    description:
      "Get a structured overview of a subject with key concepts, current state, and open questions.",
    category: "research",
    tags: ["learning", "overview"],
    starterMessage:
      "Give me a structured overview of {{topic}}. Cover: what it is and how it works, the current state of the art, major tools or projects in the space, real-world production use cases, limitations and gotchas, and where things are headed in the next 1-2 years.",
    icon: BookOpen,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "topic",
        type: "text",
        label: "What topic do you want researched?",
        placeholder: "e.g. WebAssembly for server-side use, edge computing architectures, vector databases...",
        required: true,
      },
    ],
  },

  // Creative
  {
    id: "draft-email",
    title: "Draft a Professional Email",
    description:
      "Get a polished, ready-to-send email for any professional situation.",
    category: "creative",
    tags: ["email", "writing"],
    starterMessage:
      "Draft a professional email based on the following:\n\n{{context}}\n\nMake it clear, concise, and professional. Keep it under 300 words.",
    icon: Mail,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "context",
        type: "textarea",
        label: "What's the email about?",
        placeholder: "e.g. Announce to the engineering team that we're migrating from REST to GraphQL. Tone: direct but encouraging. Include timeline and a clear ask to review the RFC by Friday...",
        required: true,
      },
    ],
  },
  {
    id: "write-proposal",
    title: "Write a Proposal or Brief",
    description:
      "Create a structured document that argues for a specific project, initiative, or approach.",
    category: "creative",
    tags: ["writing", "business"],
    starterMessage:
      "Write a one-page proposal for the following:\n\n{{proposal}}\n\nCover the problem, proposed solution, estimated effort, expected ROI, and recommended next steps.",
    icon: PenTool,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "proposal",
        type: "textarea",
        label: "What should the proposal argue for?",
        placeholder: "e.g. Adopting a design system at our 40-person startup. We have 3 frontend apps with inconsistent UI. We want to propose a component library + design tokens + Storybook...",
        required: true,
      },
    ],
  },

  // Analysis
  {
    id: "analyze-data",
    title: "Analyze a Dataset",
    description:
      "Upload data and get a full analysis with insights, trends, and visualizations.",
    category: "analysis",
    tags: ["data", "insights"],
    starterMessage:
      "Analyze this dataset. Start with a data quality assessment, then identify the most important patterns and trends. Create visualizations for the key findings. End with 3 actionable recommendations.\n\n```\n{{data}}\n```",
    icon: BarChart3,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "data",
        type: "textarea",
        label: "Paste your data (CSV, JSON, or table)",
        placeholder: "date,revenue,customers,churn_rate\n2025-01,120000,450,3.2\n2025-02,135000,480,2.8\n...",
        required: true,
      },
      {
        id: "data_file",
        type: "file",
        label: "Or upload a data file",
        placeholder: ".csv, .xlsx, .json, .tsv",
        required: false,
        accept: ".csv,.xlsx,.xls,.json,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json",
      },
    ],
  },
  {
    id: "sql-query",
    title: "Write a SQL Query",
    description:
      "Describe what you need in plain English and get a performant, well-commented SQL query.",
    category: "analysis",
    tags: ["sql", "database"],
    starterMessage:
      "Write a PostgreSQL query for the following:\n\n{{request}}\n\nDatabase schema:\n```sql\n{{schema}}\n```\n\nUse CTEs for readability, add comments explaining the logic, and note any performance considerations.",
    icon: Database,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "request",
        type: "textarea",
        label: "What should the query do?",
        placeholder: "e.g. Find all customers who made at least 3 purchases in the last 90 days but haven't logged in during the last 14 days...",
        required: true,
      },
      {
        id: "schema",
        type: "textarea",
        label: "Database schema (table definitions)",
        placeholder: "customers(id, email, name, created_at)\norders(id, customer_id, total, created_at)\nsessions(id, customer_id, started_at)",
        required: true,
      },
    ],
  },
  {
    id: "strategic-analysis",
    title: "Strategic Analysis",
    description:
      "Get a structured competitive analysis, SWOT, or market assessment for a business question.",
    category: "analysis",
    tags: ["business", "strategy"],
    starterMessage:
      "Perform a strategic analysis for the following:\n\n{{question}}\n\nInclude a comparison matrix, key insights, and actionable recommendations.",
    icon: BarChart3,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "question",
        type: "textarea",
        label: "What business question or market do you want analyzed?",
        placeholder: "e.g. Competitive analysis of the self-hosted AI platform market — compare open-source, commercial self-hosted, and cloud-managed options for a 50-person team...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Business
  // -----------------------------------------------------------------------
  {
    id: "create-slide-deck",
    title: "Create a Slide Deck",
    description:
      "Generate a professional PowerPoint presentation from your outline or topic, with proper structure and styling.",
    category: "business",
    tags: ["presentation", "pptx"],
    starterMessage:
      "Create a professional PowerPoint presentation about:\n\n{{topic}}\n\nTarget audience: {{audience}}\n\nInclude a title slide, agenda, key content slides with bullet points and visuals, and a closing slide. Make it visually clean and professional.",
    icon: Presentation,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "topic",
        type: "textarea",
        label: "Presentation topic and key points",
        placeholder: "e.g. Q1 2026 company results — revenue growth, new customers, product launches, team growth, Q2 priorities...",
        required: true,
      },
      {
        id: "topic_file",
        type: "file",
        label: "Or upload an outline or document",
        placeholder: ".txt, .md, .docx, .pdf",
        required: false,
        accept: ".txt,.md,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
      },
      {
        id: "audience",
        type: "text",
        label: "Target audience",
        placeholder: "e.g. Executive leadership, board of directors, all-hands meeting...",
        required: true,
      },
    ],
  },
  {
    id: "support-response",
    title: "Draft a Support Response",
    description:
      "Write a professional, empathetic customer support reply that addresses the issue and proposes a resolution.",
    category: "business",
    tags: ["support", "customer"],
    starterMessage:
      "Draft a professional customer support response for this situation:\n\nCustomer message:\n{{customer_message}}\n\nProduct/service context: {{context}}\n\nBe empathetic, acknowledge the issue, explain what happened if possible, and propose a clear resolution. Keep it concise.",
    icon: Headphones,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "customer_message",
        type: "textarea",
        label: "Customer's message or complaint",
        placeholder: "Paste the customer's email or support ticket here...",
        required: true,
      },
      {
        id: "context",
        type: "text",
        label: "Product/service context (optional)",
        placeholder: "e.g. SaaS billing platform, enterprise plan, customer since 2024...",
        required: false,
      },
    ],
  },
  {
    id: "internal-memo",
    title: "Write an Internal Memo",
    description:
      "Create a structured internal communication — announcements, policy changes, org updates, or post-mortems.",
    category: "business",
    tags: ["comms", "memo"],
    starterMessage:
      "Write an internal memo for the following:\n\nType: {{memo_type}}\n\nDetails:\n{{details}}\n\nAudience: {{audience}}\n\nUse a clear structure with context, key changes/decisions, impact, and next steps. Keep the tone professional but approachable.",
    icon: Megaphone,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "memo_type",
        type: "text",
        label: "Type of memo",
        placeholder: "e.g. Policy change, org restructure, post-mortem, product launch announcement...",
        required: true,
      },
      {
        id: "details",
        type: "textarea",
        label: "Key details and context",
        placeholder: "What happened, what's changing, why, and what people need to do...",
        required: true,
      },
      {
        id: "audience",
        type: "text",
        label: "Who is this for?",
        placeholder: "e.g. Engineering team, all employees, leadership team...",
        required: true,
      },
    ],
  },
  {
    id: "sales-outreach",
    title: "Write Sales Outreach",
    description:
      "Create a personalized, non-generic sales email or sequence that addresses specific pain points.",
    category: "business",
    tags: ["sales", "outreach"],
    starterMessage:
      "Write a sales outreach email based on the following:\n\nProduct/service: {{product}}\nTarget prospect: {{prospect}}\nKey value proposition: {{value_prop}}\n\nMake it personalized, concise (under 150 words), and focused on their specific pain point — not a generic pitch. Include a clear, low-friction CTA.",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "product",
        type: "text",
        label: "What are you selling?",
        placeholder: "e.g. AI-powered customer support platform, developer productivity tool...",
        required: true,
      },
      {
        id: "prospect",
        type: "textarea",
        label: "Who are you reaching out to?",
        placeholder: "e.g. VP of Engineering at a 200-person fintech company. They recently posted about scaling challenges on LinkedIn...",
        required: true,
      },
      {
        id: "value_prop",
        type: "text",
        label: "Key value proposition",
        placeholder: "e.g. Reduce support ticket resolution time by 60%...",
        required: true,
      },
    ],
  },
  {
    id: "create-invoice",
    title: "Generate an Invoice",
    description:
      "Create a professional PDF invoice with line items, totals, tax calculations, and payment terms.",
    category: "business",
    tags: ["invoice", "pdf"],
    starterMessage:
      "Generate a professional PDF invoice with the following details:\n\nFrom: {{from}}\nTo: {{to}}\n\nLine items:\n{{items}}\n\nPayment terms: {{terms}}\n\nInclude proper formatting, subtotal, tax if applicable, and total. Output as a downloadable PDF.",
    icon: Receipt,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "from",
        type: "textarea",
        label: "Your company details",
        placeholder: "Company name, address, email, phone, tax ID...",
        required: true,
      },
      {
        id: "to",
        type: "textarea",
        label: "Client details",
        placeholder: "Client name, company, address, email...",
        required: true,
      },
      {
        id: "items",
        type: "textarea",
        label: "Line items",
        placeholder: "1. Web development - 40 hours @ $150/hr\n2. UI/UX design - 20 hours @ $120/hr\n3. Hosting setup - flat fee $500",
        required: true,
      },
      {
        id: "terms",
        type: "text",
        label: "Payment terms (optional)",
        placeholder: "e.g. Net 30, due on receipt, 50% upfront...",
        required: false,
      },
    ],
  },
  {
    id: "meeting-agenda",
    title: "Create a Meeting Agenda",
    description:
      "Structure an effective meeting with timed topics, owners, and desired outcomes.",
    category: "business",
    tags: ["meetings", "planning"],
    starterMessage:
      "Create a structured meeting agenda for:\n\nMeeting type: {{meeting_type}}\nDuration: {{duration}}\nAttendees: {{attendees}}\n\nTopics to cover:\n{{topics}}\n\nInclude time allocations, discussion owners, and the desired outcome for each item. Add a pre-read section if applicable.",
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "meeting_type",
        type: "text",
        label: "Meeting type",
        placeholder: "e.g. Sprint planning, quarterly review, 1:1, project kickoff...",
        required: true,
      },
      {
        id: "duration",
        type: "text",
        label: "Duration",
        placeholder: "e.g. 30 minutes, 1 hour, 90 minutes...",
        required: true,
      },
      {
        id: "attendees",
        type: "text",
        label: "Attendees (optional)",
        placeholder: "e.g. Engineering team (8 people), cross-functional leads...",
        required: false,
      },
      {
        id: "topics",
        type: "textarea",
        label: "Topics to cover",
        placeholder: "1. Status update on migration project\n2. Decide on new hire priority\n3. Review Q2 roadmap\n4. Open discussion",
        required: true,
      },
    ],
  },
  {
    id: "job-description",
    title: "Write a Job Description",
    description:
      "Create a compelling, inclusive job posting with clear requirements, responsibilities, and company pitch.",
    category: "business",
    tags: ["hr", "hiring"],
    starterMessage:
      "Write a job description for the following role:\n\nTitle: {{title}}\nCompany context: {{company}}\nKey responsibilities: {{responsibilities}}\n\nMake it specific (avoid generic fluff), clearly separate must-haves from nice-to-haves, include compensation range if provided, and use inclusive language. Structure it with: About Us, The Role, What You'll Do, What We're Looking For, and Why Join Us.",
    icon: UserPlus,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "title",
        type: "text",
        label: "Job title",
        placeholder: "e.g. Senior Backend Engineer, Product Design Lead, DevOps Manager...",
        required: true,
      },
      {
        id: "company",
        type: "textarea",
        label: "Company context",
        placeholder: "e.g. Series B developer tools startup, 60 people, remote-first, building a cloud IDE. Stack: Go, React, Kubernetes...",
        required: true,
      },
      {
        id: "responsibilities",
        type: "textarea",
        label: "Key responsibilities and requirements",
        placeholder: "Own the authentication and authorization system, mentor 2 junior engineers, 5+ years backend experience, strong in distributed systems...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Productivity
  // -----------------------------------------------------------------------
  {
    id: "summarize-document",
    title: "Summarize a Document",
    description:
      "Upload any document and get a structured summary with key points, decisions, and takeaways.",
    category: "productivity",
    tags: ["summary", "document"],
    starterMessage:
      "Summarize this document. Provide:\n1. A one-paragraph executive summary\n2. Key points (bulleted)\n3. Decisions or conclusions made\n4. Action items (if any)\n5. Questions or gaps worth flagging\n\n{{content}}",
    icon: FolderOpen,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "content",
        type: "textarea",
        label: "Paste the document content",
        placeholder: "Paste the text you want summarized...",
        required: true,
      },
      {
        id: "content_file",
        type: "file",
        label: "Or upload a document",
        placeholder: ".pdf, .docx, .txt, .md",
        required: false,
        accept: ".pdf,.docx,.txt,.md,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown",
      },
    ],
  },
  {
    id: "translate-content",
    title: "Translate Content",
    description:
      "Translate text between languages while preserving tone, context, and technical terminology.",
    category: "productivity",
    tags: ["translation", "language"],
    starterMessage:
      "Translate the following content from {{source_lang}} to {{target_lang}}. Preserve the original tone and style. If there are technical terms or idioms, explain your translation choices.\n\n{{content}}",
    icon: Globe,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "source_lang",
        type: "text",
        label: "Source language",
        placeholder: "e.g. English, Japanese, Spanish (or 'auto-detect')...",
        required: true,
      },
      {
        id: "target_lang",
        type: "text",
        label: "Target language",
        placeholder: "e.g. French, Mandarin, German...",
        required: true,
      },
      {
        id: "content",
        type: "textarea",
        label: "Content to translate",
        placeholder: "Paste the text you want translated...",
        required: true,
      },
    ],
  },
  {
    id: "project-plan",
    title: "Create a Project Plan",
    description:
      "Break down a project into phases, milestones, tasks, and timelines with dependencies.",
    category: "productivity",
    tags: ["planning", "project"],
    starterMessage:
      "Create a detailed project plan for:\n\n{{project}}\n\nTimeline: {{timeline}}\nTeam size: {{team}}\n\nBreak it into phases with milestones. For each phase, list specific tasks with estimated effort, dependencies, and owners (if applicable). Identify risks and propose mitigations. Include a week-by-week timeline.",
    icon: Workflow,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "project",
        type: "textarea",
        label: "Project description",
        placeholder: "e.g. Migrate our monolithic Rails app to microservices. Currently serving 50k RPM. Need to maintain uptime during migration...",
        required: true,
      },
      {
        id: "timeline",
        type: "text",
        label: "Target timeline",
        placeholder: "e.g. 3 months, Q2 2026, 6 weeks...",
        required: true,
      },
      {
        id: "team",
        type: "text",
        label: "Team size and composition (optional)",
        placeholder: "e.g. 4 backend engineers, 1 DevOps, 1 PM...",
        required: false,
      },
    ],
  },
  {
    id: "compare-documents",
    title: "Compare Two Documents",
    description:
      "Upload two versions of a document and get a detailed diff with highlighted changes, additions, and deletions.",
    category: "productivity",
    tags: ["compare", "diff"],
    starterMessage:
      "Compare these two versions of a document. Highlight what changed, what was added, and what was removed. Summarize the key differences and flag anything that looks like it might be an error.\n\nVersion 1:\n{{version1}}\n\nVersion 2:\n{{version2}}",
    icon: Layers,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "version1",
        type: "textarea",
        label: "Version 1 (original)",
        placeholder: "Paste the original version...",
        required: true,
      },
      {
        id: "version1_file",
        type: "file",
        label: "Or upload version 1",
        placeholder: ".txt, .md, .docx, .pdf",
        required: false,
        accept: ".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      {
        id: "version2",
        type: "textarea",
        label: "Version 2 (updated)",
        placeholder: "Paste the updated version...",
        required: true,
      },
      {
        id: "version2_file",
        type: "file",
        label: "Or upload version 2",
        placeholder: ".txt, .md, .docx, .pdf",
        required: false,
        accept: ".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  },
  {
    id: "extract-pdf-data",
    title: "Extract Data from PDF",
    description:
      "Pull structured data, tables, or specific information from a PDF document into a usable format.",
    category: "productivity",
    tags: ["pdf", "extraction"],
    starterMessage:
      "Extract data from this PDF. Specifically, I need:\n\n{{content}}\n\nOutput the extracted data as {{output_format}}.",
    icon: FileText,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "content",
        type: "textarea",
        label: "What should be extracted?",
        placeholder: "e.g. All tables with financial data, contact information from each page, the terms and conditions section, all dates and amounts...",
        required: true,
      },
      {
        id: "content_file",
        type: "file",
        label: "Upload a PDF",
        placeholder: ".pdf",
        required: false,
        accept: ".pdf,application/pdf",
      },
      {
        id: "output_format",
        type: "text",
        label: "Desired output format (optional)",
        placeholder: "e.g. CSV, Excel spreadsheet, JSON, markdown table...",
        required: false,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Design
  // -----------------------------------------------------------------------
  {
    id: "create-diagram",
    title: "Draw a Diagram",
    description:
      "Create an interactive, editable diagram — flowcharts, architecture, sequence diagrams, ERDs, and more.",
    category: "design",
    tags: ["diagram", "excalidraw"],
    starterMessage:
      "Create a {{diagram_type}} diagram for:\n\n{{description}}\n\nMake it clear, well-organized, and use appropriate shapes and colors. Output as an interactive Excalidraw diagram I can edit.",
    icon: Blocks,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "diagram_type",
        type: "text",
        label: "Diagram type",
        placeholder: "e.g. flowchart, architecture diagram, sequence diagram, ERD, mind map, org chart...",
        required: true,
      },
      {
        id: "description",
        type: "textarea",
        label: "What should the diagram show?",
        placeholder: "e.g. User authentication flow — from login page through OAuth, MFA verification, session creation, and redirect to dashboard...",
        required: true,
      },
    ],
  },
  {
    id: "design-landing-page",
    title: "Design a Landing Page",
    description:
      "Get a working, visually distinctive landing page with hero, features, pricing, and CTA sections.",
    category: "design",
    tags: ["web", "landing"],
    starterMessage:
      "Design and build a landing page for:\n\n{{product}}\n\nTarget audience: {{audience}}\nDesign style: {{style}}\n\nInclude: hero section with headline and CTA, feature highlights, social proof/testimonials placeholder, pricing (if applicable), and a footer. Make it responsive and visually distinctive — no generic AI-looking templates.",
    icon: Paintbrush,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "product",
        type: "textarea",
        label: "Product or service description",
        placeholder: "e.g. An open-source project management tool for remote teams. Key features: async standups, time zone-aware scheduling, GitHub integration...",
        required: true,
      },
      {
        id: "audience",
        type: "text",
        label: "Target audience",
        placeholder: "e.g. Engineering managers at mid-size startups...",
        required: true,
      },
      {
        id: "style",
        type: "text",
        label: "Design style (optional)",
        placeholder: "e.g. Minimalist, bold and colorful, dark mode, editorial, retro...",
        required: false,
      },
    ],
  },
  {
    id: "color-palette",
    title: "Generate a Color Palette",
    description:
      "Create a harmonious color palette with hex codes, usage guidelines, and accessibility contrast ratios.",
    category: "design",
    tags: ["colors", "branding"],
    starterMessage:
      "Generate a color palette for:\n\n{{context}}\n\nMood/vibe: {{mood}}\n\nProvide: primary, secondary, accent, neutral, success, warning, and danger colors with hex codes. Include light and dark mode variants, accessibility contrast ratios (WCAG AA), and a visual preview. Suggest font pairings that complement the palette.",
    icon: Palette,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "context",
        type: "text",
        label: "What is this for?",
        placeholder: "e.g. A health and wellness app, a developer tools brand, a luxury e-commerce site...",
        required: true,
      },
      {
        id: "mood",
        type: "text",
        label: "Mood or vibe",
        placeholder: "e.g. Calm and trustworthy, energetic and playful, premium and sophisticated...",
        required: true,
      },
    ],
  },
  {
    id: "generative-art",
    title: "Create Generative Art",
    description:
      "Generate unique algorithmic artwork using p5.js with creative coding techniques.",
    category: "design",
    tags: ["art", "creative-coding"],
    starterMessage:
      "Create a piece of generative art based on this concept:\n\n{{concept}}\n\nStyle preferences: {{style}}\n\nUse p5.js with seeded randomness so the result is reproducible. Create something visually striking and original — not a generic demo.",
    icon: Sparkles,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "concept",
        type: "textarea",
        label: "Art concept or inspiration",
        placeholder: "e.g. The visual rhythm of ocean waves, neural network connections as organic forms, the geometry of city grids from above...",
        required: true,
      },
      {
        id: "style",
        type: "text",
        label: "Style preferences (optional)",
        placeholder: "e.g. Monochrome, watercolor feel, geometric, particle-based, organic...",
        required: false,
      },
    ],
  },
  {
    id: "build-widget",
    title: "Build an Interactive Widget",
    description:
      "Create a functional React web artifact — dashboards, calculators, tools, or interactive visualizations.",
    category: "design",
    tags: ["react", "interactive"],
    starterMessage:
      "Build an interactive web widget/tool:\n\n{{description}}\n\nMake it fully functional with proper state management, responsive design, and polished UI. Use React with shadcn/ui components.",
    icon: LayoutDashboard,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "description",
        type: "textarea",
        label: "What should the widget do?",
        placeholder: "e.g. A mortgage calculator with amortization schedule chart, a Pomodoro timer with task tracking, a color contrast checker for accessibility...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Education
  // -----------------------------------------------------------------------
  {
    id: "create-quiz",
    title: "Create a Quiz",
    description:
      "Generate an interactive quiz with multiple choice, true/false, and open-ended questions with explanations.",
    category: "education",
    tags: ["quiz", "learning"],
    starterMessage:
      "Create a quiz about {{topic}} for {{audience}}.\n\nDifficulty: {{difficulty}}\n\nInclude 10 questions mixing multiple choice, true/false, and short answer. For each question, provide the correct answer and a brief explanation of why it's correct.",
    icon: Award,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "topic",
        type: "text",
        label: "Quiz topic",
        placeholder: "e.g. JavaScript closures, American Civil War, organic chemistry, machine learning fundamentals...",
        required: true,
      },
      {
        id: "audience",
        type: "text",
        label: "Target audience",
        placeholder: "e.g. College freshmen, senior developers, high school students...",
        required: true,
      },
      {
        id: "difficulty",
        type: "text",
        label: "Difficulty level (optional)",
        placeholder: "e.g. Beginner, intermediate, advanced, mixed...",
        required: false,
      },
    ],
  },
  {
    id: "study-guide",
    title: "Create a Study Guide",
    description:
      "Generate a comprehensive study guide with key concepts, examples, practice questions, and mnemonics.",
    category: "education",
    tags: ["study", "learning"],
    starterMessage:
      "Create a comprehensive study guide for:\n\n{{subject}}\n\nCover: key concepts with clear explanations, important formulas or rules, worked examples, common mistakes to avoid, mnemonics or memory aids, and 5 practice questions with answers.",
    icon: GraduationCap,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "subject",
        type: "text",
        label: "Subject or exam topic",
        placeholder: "e.g. Calculus II integrals, AWS Solutions Architect exam, constitutional law, data structures...",
        required: true,
      },
    ],
  },
  {
    id: "eli5",
    title: "ELI5 — Explain Like I'm 5",
    description:
      "Get a dead-simple explanation of any concept using everyday analogies and zero jargon.",
    category: "education",
    tags: ["explanation", "simple"],
    starterMessage:
      "Explain {{concept}} like I'm 5 years old. Use simple analogies from everyday life. No jargon whatsoever. Then gradually add complexity: explain it for a teenager, then for a college student. Keep each level to 2-3 sentences.",
    icon: Lightbulb,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "concept",
        type: "text",
        label: "What concept?",
        placeholder: "e.g. Blockchain, quantum computing, CRISPR gene editing, how the stock market works...",
        required: true,
      },
    ],
  },
  {
    id: "lesson-plan",
    title: "Create a Lesson Plan",
    description:
      "Design a structured lesson with objectives, activities, assessments, and timing for any subject.",
    category: "education",
    tags: ["teaching", "planning"],
    starterMessage:
      "Create a lesson plan for:\n\nSubject: {{subject}}\nDuration: {{duration}}\nAudience: {{audience}}\n\nInclude: learning objectives, prerequisite knowledge, lesson outline with timing, interactive activities, assessment methods, and homework/follow-up resources.",
    icon: BookOpen,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "subject",
        type: "textarea",
        label: "What is the lesson about?",
        placeholder: "e.g. Introduction to recursion in Python, World War II causes, photosynthesis, financial literacy for teens...",
        required: true,
      },
      {
        id: "duration",
        type: "text",
        label: "Lesson duration",
        placeholder: "e.g. 45 minutes, 1 hour, 2-hour workshop...",
        required: true,
      },
      {
        id: "audience",
        type: "text",
        label: "Student audience",
        placeholder: "e.g. High school sophomores, bootcamp students, university freshmen...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Analysis (additions)
  // -----------------------------------------------------------------------
  {
    id: "analyze-spreadsheet",
    title: "Analyze a Spreadsheet",
    description:
      "Upload an Excel or CSV file and get automated analysis with pivot tables, charts, and insights.",
    category: "analysis",
    tags: ["excel", "spreadsheet"],
    starterMessage:
      "Analyze this spreadsheet data. Provide:\n1. Data overview (shape, columns, types, missing values)\n2. Summary statistics for numerical columns\n3. Key patterns and correlations\n4. Charts for the most interesting findings\n5. Anomalies or data quality issues\n\nFocus area: {{content}}",
    icon: FileSpreadsheet,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "content",
        type: "textarea",
        label: "Describe your data or paste a sample",
        placeholder: "Describe the spreadsheet contents, paste sample data, or just say 'general analysis'...",
        required: true,
      },
      {
        id: "content_file",
        type: "file",
        label: "Or upload a spreadsheet",
        placeholder: ".xlsx, .xls, .csv",
        required: false,
        accept: ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv",
      },
    ],
  },
  {
    id: "financial-model",
    title: "Build a Financial Model",
    description:
      "Create projections, unit economics, or scenario analysis with formulas, assumptions, and charts.",
    category: "analysis",
    tags: ["finance", "modeling"],
    starterMessage:
      "Build a financial model for:\n\n{{scenario}}\n\nAssumptions:\n{{assumptions}}\n\nInclude: revenue projections, cost structure, unit economics, break-even analysis, and sensitivity analysis for key variables. Create charts for the most important metrics. Output as an Excel file.",
    icon: TrendingUp,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "scenario",
        type: "textarea",
        label: "What should the model project?",
        placeholder: "e.g. SaaS startup with $50/mo plan, 10% monthly growth, 3% churn. Current: 200 customers. Model 24 months forward...",
        required: true,
      },
      {
        id: "assumptions",
        type: "textarea",
        label: "Key assumptions",
        placeholder: "e.g. CAC: $200, LTV target: 3x CAC, gross margin: 80%, team grows from 5 to 15 over 12 months, avg salary $120k...",
        required: true,
      },
    ],
  },
  {
    id: "regex-builder",
    title: "Build & Test a Regex",
    description:
      "Describe what you need to match in plain English and get a tested, explained regex pattern.",
    category: "analysis",
    tags: ["regex", "pattern"],
    starterMessage:
      "Build a regex pattern for the following:\n\n{{what_to_match}}\n\nExample strings that should match:\n{{examples}}\n\nExplain the regex step by step, test it against the examples, and show edge cases it handles correctly and ones to watch out for. Provide the pattern in both JavaScript and Python syntax.",
    icon: Zap,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "what_to_match",
        type: "textarea",
        label: "What should the regex match?",
        placeholder: "e.g. Email addresses, US phone numbers in any format, URLs with optional www and port, ISO dates with optional time...",
        required: true,
      },
      {
        id: "examples",
        type: "textarea",
        label: "Example strings to test against (optional)",
        placeholder: "Match: user@example.com, test.name+tag@domain.co.uk\nDon't match: @invalid, user@, plaintext",
        required: false,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Code (additions)
  // -----------------------------------------------------------------------
  {
    id: "generate-tests",
    title: "Generate Unit Tests",
    description:
      "Paste a function or module and get comprehensive test cases covering happy paths, edge cases, and error handling.",
    category: "code",
    tags: ["testing", "quality"],
    starterMessage:
      "Write comprehensive unit tests for this code:\n\n```\n{{code}}\n```\n\nTest framework: {{framework}}\n\nCover: happy path, edge cases, error handling, boundary values, and null/undefined inputs. Use descriptive test names that read like documentation.",
    icon: TestTube,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "code",
        type: "textarea",
        label: "Code to test",
        placeholder: "Paste the function, class, or module you want tests for...",
        required: true,
      },
      {
        id: "code_file",
        type: "file",
        label: "Or upload a source file",
        placeholder: ".ts, .py, .go, .rs, .java, ...",
        required: false,
        accept: "text/*,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php",
      },
      {
        id: "framework",
        type: "text",
        label: "Test framework (optional)",
        placeholder: "e.g. Jest, pytest, vitest, Go testing, JUnit...",
        required: false,
      },
    ],
  },
  {
    id: "convert-code",
    title: "Convert Code Between Languages",
    description:
      "Translate code from one programming language to another while preserving logic and using idiomatic patterns.",
    category: "code",
    tags: ["conversion", "languages"],
    starterMessage:
      "Convert this code from {{source_lang}} to {{target_lang}}:\n\n```\n{{code}}\n```\n\nUse idiomatic patterns for the target language. Preserve the logic and behavior exactly. Add comments noting any significant differences in approach.",
    icon: GitBranch,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "source_lang",
        type: "text",
        label: "Source language",
        placeholder: "e.g. Python, JavaScript, Java, Go...",
        required: true,
      },
      {
        id: "target_lang",
        type: "text",
        label: "Target language",
        placeholder: "e.g. TypeScript, Rust, C#, Swift...",
        required: true,
      },
      {
        id: "code",
        type: "textarea",
        label: "Code to convert",
        placeholder: "Paste the code you want converted...",
        required: true,
      },
      {
        id: "code_file",
        type: "file",
        label: "Or upload a source file",
        placeholder: ".py, .js, .java, .go, ...",
        required: false,
        accept: "text/*,.py,.js,.ts,.java,.go,.rs,.rb,.php,.cs,.swift,.kt",
      },
    ],
  },
  {
    id: "api-docs",
    title: "Generate API Documentation",
    description:
      "Create OpenAPI/Swagger-style documentation from code, with examples, error codes, and usage guides.",
    category: "code",
    tags: ["documentation", "api"],
    starterMessage:
      "Generate API documentation for the following:\n\n```\n{{code}}\n```\n\nInclude: endpoint descriptions, request/response schemas with examples, authentication requirements, error codes and messages, rate limiting info (if applicable), and curl examples. Format as clean Markdown.",
    icon: FileText,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "code",
        type: "textarea",
        label: "API code or route definitions",
        placeholder: "Paste your API routes, controller code, or endpoint definitions...",
        required: true,
      },
      {
        id: "code_file",
        type: "file",
        label: "Or upload source files",
        placeholder: ".ts, .py, .go, .java, ...",
        required: false,
        accept: "text/*,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php",
      },
    ],
  },
  {
    id: "db-schema",
    title: "Design a Database Schema",
    description:
      "Get a normalized database schema with tables, relationships, indexes, and migration SQL from a description.",
    category: "code",
    tags: ["database", "schema"],
    starterMessage:
      "Design a database schema for:\n\n{{requirements}}\n\nDatabase: {{database}}\n\nProvide: table definitions with columns and types, primary and foreign keys, indexes for common queries, an ER diagram, and migration SQL. Explain normalization decisions.",
    icon: Database,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "requirements",
        type: "textarea",
        label: "What does the database need to store?",
        placeholder: "e.g. A multi-tenant SaaS app with users, organizations, projects, tasks, comments, file attachments, and an audit log. Users can belong to multiple orgs with different roles...",
        required: true,
      },
      {
        id: "database",
        type: "text",
        label: "Database system (optional)",
        placeholder: "e.g. PostgreSQL, MySQL, SQLite, MongoDB...",
        required: false,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Creative (additions)
  // -----------------------------------------------------------------------
  {
    id: "write-docs",
    title: "Write Technical Documentation",
    description:
      "Create clear, well-structured technical docs — READMEs, guides, runbooks, or architecture decision records.",
    category: "creative",
    tags: ["writing", "documentation"],
    starterMessage:
      "Write {{doc_type}} documentation for:\n\n{{subject}}\n\nTarget reader: {{reader}}\n\nMake it clear, scannable, and immediately useful. Include code examples where helpful. Structure it so someone can find what they need in 30 seconds.",
    icon: Pencil,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "doc_type",
        type: "text",
        label: "Documentation type",
        placeholder: "e.g. README, getting started guide, runbook, ADR, API reference, troubleshooting guide...",
        required: true,
      },
      {
        id: "subject",
        type: "textarea",
        label: "What are you documenting?",
        placeholder: "e.g. Our internal deployment pipeline — deploys to staging via PR merge, production via release tag. Uses Terraform + Kubernetes + ArgoCD...",
        required: true,
      },
      {
        id: "reader",
        type: "text",
        label: "Target reader",
        placeholder: "e.g. New engineer on the team, external API consumer, on-call engineer...",
        required: true,
      },
    ],
  },
  {
    id: "write-blog",
    title: "Write a Blog Post",
    description:
      "Draft a well-structured blog post with a compelling hook, clear narrative, and strong conclusion.",
    category: "creative",
    tags: ["writing", "content"],
    starterMessage:
      "Write a blog post about:\n\n{{topic}}\n\nTarget audience: {{audience}}\nTone: {{tone}}\nTarget length: {{length}}\n\nStart with a hook that makes the reader want to continue. Use concrete examples, not abstract statements. End with a clear takeaway or call to action.",
    icon: PenTool,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "topic",
        type: "textarea",
        label: "Blog post topic and key points",
        placeholder: "e.g. Why we migrated from microservices back to a monolith — the hidden costs of distributed systems at our scale (20 engineers, 50k users)...",
        required: true,
      },
      {
        id: "audience",
        type: "text",
        label: "Target audience",
        placeholder: "e.g. Senior engineers, startup founders, product managers...",
        required: true,
      },
      {
        id: "tone",
        type: "text",
        label: "Tone (optional)",
        placeholder: "e.g. Technical but approachable, opinionated, conversational, formal...",
        required: false,
      },
      {
        id: "length",
        type: "text",
        label: "Target length (optional)",
        placeholder: "e.g. 1500 words, short (500 words), long-form (3000+ words)...",
        required: false,
      },
    ],
  },
  {
    id: "user-story",
    title: "Write User Stories",
    description:
      "Turn a feature idea into well-structured user stories with acceptance criteria, edge cases, and technical notes.",
    category: "creative",
    tags: ["agile", "product"],
    starterMessage:
      "Break this feature into user stories:\n\n{{feature}}\n\nFor each story, provide:\n- Title in 'As a [role], I want [goal], so that [benefit]' format\n- Acceptance criteria (Given/When/Then)\n- Edge cases to consider\n- Technical implementation notes\n- Story point estimate (S/M/L)\n\nOrder them by dependency and suggest which can be parallelized.",
    icon: ClipboardCheck,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "feature",
        type: "textarea",
        label: "Feature description",
        placeholder: "e.g. Add team-based permissions to our SaaS app. Users should be able to create teams, invite members with roles (admin/member/viewer), and restrict project access by team...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Research (additions)
  // -----------------------------------------------------------------------
  {
    id: "fact-check",
    title: "Fact Check a Claim",
    description:
      "Evaluate the accuracy of a statement or claim with evidence, sources, and nuance.",
    category: "research",
    tags: ["verification", "facts"],
    starterMessage:
      "Evaluate the accuracy of this claim:\n\n\"{{claim}}\"\n\nContext where I encountered it: {{context}}\n\nProvide: your assessment (true/false/partially true/misleading), supporting evidence, important nuances or caveats, and what a more accurate statement would be.",
    icon: Shield,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "claim",
        type: "textarea",
        label: "Claim to fact-check",
        placeholder: "e.g. 90% of startups fail within the first 5 years, TypeScript adds 30% to development time, GPT-4 passed the bar exam in the 90th percentile...",
        required: true,
      },
      {
        id: "context",
        type: "text",
        label: "Where did you see this? (optional)",
        placeholder: "e.g. A blog post about startup metrics, a conference talk, a tweet...",
        required: false,
      },
    ],
  },
  {
    id: "market-research",
    title: "Market Research",
    description:
      "Get a structured market analysis with size estimates, competitors, trends, and go-to-market insights.",
    category: "research",
    tags: ["market", "business"],
    starterMessage:
      "Conduct market research for:\n\n{{product_idea}}\n\nCover:\n1. Market size (TAM/SAM/SOM estimates)\n2. Key competitors and their positioning\n3. Target customer segments\n4. Current market trends and tailwinds\n5. Potential barriers to entry\n6. Go-to-market strategy recommendations\n7. Pricing benchmarks in this space",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "product_idea",
        type: "textarea",
        label: "Product or business idea",
        placeholder: "e.g. An AI-powered tool that auto-generates compliance documentation for fintech startups. Target: Series A-C fintechs in the US and EU dealing with SOX, PCI-DSS, and GDPR requirements...",
        required: true,
      },
    ],
  },

  // -----------------------------------------------------------------------
  // General (additions)
  // -----------------------------------------------------------------------
  {
    id: "pros-cons",
    title: "Weigh a Decision",
    description:
      "Get a structured pros/cons analysis with weighted criteria for any personal or professional decision.",
    category: "general",
    tags: ["decision", "analysis"],
    starterMessage:
      "Help me decide: {{decision}}\n\nContext:\n{{context}}\n\nProvide a weighted pros/cons analysis. Consider short-term and long-term implications, reversibility, opportunity cost, and second-order effects. End with a clear recommendation and the key factor that should drive the decision.",
    icon: Scale,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "decision",
        type: "text",
        label: "What decision are you facing?",
        placeholder: "e.g. Should I accept a higher-paying job at a big company vs. stay at my current startup?",
        required: true,
      },
      {
        id: "context",
        type: "textarea",
        label: "Relevant context",
        placeholder: "e.g. Current startup: 20 people, I'm employee #5, 1.5% equity, below-market salary. New offer: 40% raise, RSUs, but 500-person company. I value autonomy and learning but have a mortgage...",
        required: true,
      },
    ],
  },
  {
    id: "standup-summary",
    title: "Format a Standup Update",
    description:
      "Turn scattered notes into a clean standup update with yesterday's progress, today's plan, and blockers.",
    category: "general",
    tags: ["standup", "productivity"],
    starterMessage:
      "Format this into a clean standup update. Use the structure: Done (yesterday), Doing (today), Blocked (if any). Keep each item to one line. Group by project if multiple projects are mentioned.\n\n{{notes}}",
    icon: ClipboardCheck,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "notes",
        type: "textarea",
        label: "Your raw notes or brain dump",
        placeholder: "e.g. worked on the auth migration most of the day, PR is up but needs review from Sarah. Today I'll start on the billing API but waiting on the Stripe webhook docs from Mike. Also fixed that flaky test in CI...",
        required: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  onChat,
  onView,
}: {
  agent: any;
  onChat: (agent: any) => void;
  onView: (agent: any) => void;
}) {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={getAgentBgStyle(getAgentColor(agent))}>
          <Bot className="h-5 w-5" style={getAgentIconStyle(getAgentColor(agent))} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
          {agent.visibility && (
            <Badge variant={agent.visibility === "public" ? "primary" : "default"} className="mt-0.5">
              {agent.visibility}
            </Badge>
          )}
        </div>
      </div>
      {agent.description && (
        <p className="text-xs text-text-tertiary line-clamp-2 mb-3 flex-1">{agent.description}</p>
      )}
      <div className="flex items-center gap-2 mt-auto">
        {typeof agent.usageCount === "number" && (
          <div className="flex items-center gap-1 mr-auto">
            <Star className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
            <span className="text-[10px] text-text-tertiary">{agent.usageCount}</span>
          </div>
        )}
        <button
          onClick={() => onView(agent)}
          className="text-xs text-text-tertiary hover:text-text transition-colors"
        >
          View
        </button>
        <Button variant="ghost" size="sm" onClick={() => onChat(agent)}>
          <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" />
          Chat
        </Button>
      </div>
    </div>
  );
}

function ConversationCard({
  conversation,
  onStart,
}: {
  conversation: SampleConversation;
  onStart: (conversation: SampleConversation) => void;
}) {
  const { t } = useTranslation();
  const Icon = conversation.icon;

  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-xl ${conversation.bgColor} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${conversation.color}`} aria-hidden="true" />
        </div>
        <div className="flex gap-1">
          {conversation.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface border border-border text-text-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-text mb-1">
        {conversation.title}
      </h3>
      <p className="text-xs text-text-tertiary leading-relaxed mb-4 flex-1">
        {conversation.description}
      </p>

      <button
        onClick={() => onStart(conversation)}
        className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors group-hover:gap-3"
      >
        {t("explore.tryConversation", "Try this conversation")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ExplorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<SampleConversation | null>(null);

  // Fetch published agents
  const { data: agentsData } = useQuery({
    queryKey: ["agents-marketplace", "explore"],
    queryFn: () => api.get<any>("/api/agents/marketplace/browse"),
    staleTime: 60_000,
  });

  const publishedAgents: any[] = (agentsData as any)?.data ?? [];

  const filteredConversations = useMemo(() => {
    let result = sampleConversations;

    if (activeCategory !== "all" && activeCategory !== "agents") {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [activeCategory, searchQuery]);

  const filteredAgents = useMemo(() => {
    let result = publishedAgents;

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q),
      );
    }

    return result.slice(0, activeCategory === "agents" ? 12 : 6);
  }, [publishedAgents, activeCategory, searchQuery]);

  const showAgents = filteredAgents.length > 0;
  const showConversations = activeCategory !== "agents";

  const handleStartConversation = (conversation: SampleConversation) => {
    if (conversation.inputs?.length) {
      setSelectedTemplate(conversation);
      return;
    }
    try {
      sessionStorage.setItem("nova:starter-message", conversation.starterMessage);
    } catch {
      // sessionStorage unavailable
    }
    navigate({ to: "/conversations/new" });
  };

  const handleTemplateSubmit = (resolvedMessage: string, files?: File[]) => {
    if (files?.length) {
      setPendingFiles(files);
    }
    try {
      sessionStorage.setItem("nova:starter-message", resolvedMessage);
    } catch {
      // sessionStorage unavailable
    }
    setSelectedTemplate(null);
    navigate({ to: "/conversations/new" });
  };

  const handleChatWithAgent = (agent: any) => {
    navigate({ to: "/conversations/new", search: { agentId: agent.id } });
  };

  const handleViewAgent = (agent: any) => {
    navigate({ to: `/agents/${agent.id}` });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Compass className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">{t("explore.title", "Explore")}</h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {t("explore.subtitle", "Discover agents and sample conversations to get started with NOVA.")}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-6 input-glow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("explore.searchPlaceholder", "Search agents and conversations...")}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap max-w-2xl mx-auto">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-secondary border border-border text-text-secondary hover:text-text hover:border-border-strong"
                }`}
              >
                <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Featured Agents */}
        {showAgents && filteredAgents.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text">
                {t("explore.featuredAgents", "Agents")}
              </h2>
              <button
                onClick={() => navigate({ to: "/agents/marketplace" })}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
              >
                {t("explore.viewAllAgents", "View all")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent: any) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onChat={handleChatWithAgent}
                  onView={handleViewAgent}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sample Conversations */}
        {showConversations && (
          <>
            {showAgents && filteredAgents.length > 0 && (
              <h2 className="text-lg font-semibold text-text mb-4">
                {t("explore.sampleConversations", "Get Started")}
              </h2>
            )}

            {filteredConversations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    onStart={handleStartConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-text-secondary">
                  {t("explore.noResults", "No results matching your search")}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className="text-xs text-primary hover:text-primary-dark mt-2 underline"
                >
                  {t("explore.clearFilters", "Clear filters")}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state for agents-only filter with no agents */}
        {activeCategory === "agents" && filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <Bot className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {searchQuery
                ? t("explore.noAgentsSearch", "No agents matching your search")
                : t("explore.noAgentsPublished", "No published agents yet")}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-text-tertiary mb-3">
            {t("explore.ctaText", "Don't see what you're looking for?")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate({ to: "/conversations/new" })}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {t("explore.startBlank", "Start a blank conversation")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/agents/new" })}
            >
              <Bot className="h-4 w-4" aria-hidden="true" />
              {t("explore.createAgent", "Create an agent")}
            </Button>
          </div>
        </div>
      </div>

      <TemplateInputDialog
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        conversation={selectedTemplate}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}
