export const promptDefs = [
  {
    name: "Code Review",
    description: "Thorough code review with actionable feedback",
    category: "development",
    content: "Review the following code. Focus on:\n- Bugs and edge cases\n- Performance concerns\n- Security vulnerabilities\n- Readability and maintainability\n\nProvide specific, actionable suggestions with code examples where appropriate.\n\n```{{language}}\n{{code}}\n```",
    variables: [{ name: "language", description: "Programming language" }, { name: "code", description: "Code to review" }],
    systemPrompt: "You are a senior software engineer performing a thorough code review. Be direct, specific, and constructive.",
  },
  {
    name: "Explain Like I'm 5",
    description: "Break down complex topics into simple explanations",
    category: "education",
    content: "Explain the following topic in simple terms that anyone could understand. Use analogies and everyday examples.\n\nTopic: {{topic}}",
    variables: [{ name: "topic", description: "The topic to explain" }],
    systemPrompt: "You explain complex topics using simple language, relatable analogies, and short sentences. Avoid jargon.",
  },
  {
    name: "Technical Architecture",
    description: "Design system architecture for a given problem",
    category: "development",
    content: "Design a technical architecture for the following requirement:\n\n{{requirement}}\n\nInclude:\n- High-level component diagram (describe in text)\n- Data flow\n- Technology choices with rationale\n- Scalability considerations\n- Potential failure points and mitigations",
    variables: [{ name: "requirement", description: "System requirement or problem statement" }],
    systemPrompt: "You are a principal architect with deep experience in distributed systems. Be opinionated about technology choices and justify your decisions.",
  },
  {
    name: "Meeting Summary",
    description: "Summarize meeting notes into structured action items",
    category: "productivity",
    content: "Summarize the following meeting notes into:\n1. Key decisions made\n2. Action items (with owners if mentioned)\n3. Open questions\n4. Next steps\n\nMeeting notes:\n{{notes}}",
    variables: [{ name: "notes", description: "Raw meeting notes or transcript" }],
    systemPrompt: "You distill unstructured meeting notes into clear, concise summaries. Focus on what was decided and what needs to happen next.",
  },
  {
    name: "SQL Query Builder",
    description: "Generate SQL queries from natural language descriptions",
    category: "development",
    content: "Write a SQL query for the following request:\n\n{{request}}\n\nDatabase schema:\n{{schema}}\n\nUse PostgreSQL syntax. Include comments explaining the query logic.",
    variables: [{ name: "request", description: "What the query should do" }, { name: "schema", description: "Relevant table definitions" }],
    systemPrompt: "You are a database expert. Write clean, performant SQL. Prefer CTEs over subqueries. Always consider index usage.",
  },

  // ── Writing ──

  {
    name: "Email Drafter",
    description: "Draft professional emails for any context",
    category: "writing",
    content: "Draft an email with the following details:\n\nPurpose: {{purpose}}\nRecipient: {{recipient}}\nTone: {{tone}}\n\nAdditional context:\n{{context}}",
    variables: [
      { name: "purpose", description: "What the email should accomplish" },
      { name: "recipient", description: "Who the email is for (role/relationship)" },
      { name: "tone", description: "e.g. formal, friendly, urgent, apologetic" },
      { name: "context", description: "Any relevant background information" },
    ],
    systemPrompt: "You write clear, concise professional emails. Get to the point quickly. Use appropriate formality for the context.",
  },
  {
    name: "Blog Post Outline",
    description: "Generate a structured outline for a blog post",
    category: "writing",
    content: "Create a detailed blog post outline on the following topic:\n\nTopic: {{topic}}\nTarget audience: {{audience}}\nDesired length: {{length}}\n\nInclude a compelling title, introduction hook, main sections with key points, and a conclusion with call-to-action.",
    variables: [
      { name: "topic", description: "Blog post topic" },
      { name: "audience", description: "Who will read this" },
      { name: "length", description: "e.g. 800 words, 1500 words" },
    ],
    systemPrompt: "You are a content strategist. Create outlines that are structured for readability and SEO. Each section should have a clear purpose.",
  },
  {
    name: "Press Release",
    description: "Draft a press release following AP style",
    category: "writing",
    content: "Write a press release for the following announcement:\n\n{{announcement}}\n\nCompany: {{company}}\nKey spokesperson: {{spokesperson}}\nTarget media: {{media}}",
    variables: [
      { name: "announcement", description: "What is being announced" },
      { name: "company", description: "Company name and brief description" },
      { name: "spokesperson", description: "Name and title of the quoted person" },
      { name: "media", description: "e.g. tech press, business media, local news" },
    ],
    systemPrompt: "You write press releases in AP style. Lead with the news, include a strong quote, and end with a boilerplate. Keep it under 500 words.",
  },
  {
    name: "Content Rewriter",
    description: "Rewrite content for a different audience or tone",
    category: "writing",
    content: "Rewrite the following content:\n\nOriginal:\n{{original}}\n\nNew target audience: {{audience}}\nNew tone: {{tone}}\nAdditional instructions: {{instructions}}",
    variables: [
      { name: "original", description: "The content to rewrite" },
      { name: "audience", description: "New target audience" },
      { name: "tone", description: "Desired tone" },
      { name: "instructions", description: "Any specific changes to make" },
    ],
    systemPrompt: "You adapt written content for different audiences while preserving the core message. Maintain accuracy but adjust vocabulary, complexity, and framing.",
  },

  // ── Business ──

  {
    name: "SWOT Analysis",
    description: "Generate a SWOT analysis for a business or initiative",
    category: "business",
    content: "Create a SWOT analysis for:\n\n{{subject}}\n\nContext:\n{{context}}\n\nProvide 4-6 points for each quadrant (Strengths, Weaknesses, Opportunities, Threats) with brief explanations.",
    variables: [
      { name: "subject", description: "Company, product, or initiative to analyze" },
      { name: "context", description: "Industry, competitive landscape, or other relevant info" },
    ],
    systemPrompt: "You are a strategy consultant. Provide balanced, evidence-based SWOT analyses. Be specific — avoid generic points that could apply to any company.",
  },
  {
    name: "Executive Summary",
    description: "Condense a document into an executive summary",
    category: "business",
    content: "Write an executive summary of the following document. Target length: {{length}}.\n\n{{document}}",
    variables: [
      { name: "document", description: "The full document to summarize" },
      { name: "length", description: "e.g. 200 words, half page, one page" },
    ],
    systemPrompt: "You write executive summaries for senior leaders. Lead with the conclusion/recommendation, then supporting evidence. Every sentence should earn its place.",
  },
  {
    name: "OKR Generator",
    description: "Generate objectives and key results from a goal",
    category: "business",
    content: "Create OKRs for the following goal:\n\nGoal: {{goal}}\nTeam/Department: {{team}}\nTime period: {{period}}\n\nGenerate 2-3 Objectives, each with 3-4 measurable Key Results.",
    variables: [
      { name: "goal", description: "High-level goal or strategic priority" },
      { name: "team", description: "Which team or department" },
      { name: "period", description: "e.g. Q2 2026, H1 2026" },
    ],
    systemPrompt: "You are an OKR coach. Objectives should be qualitative and inspirational. Key Results must be quantitative, time-bound, and verifiable. Avoid vanity metrics.",
  },
  {
    name: "Competitive Analysis",
    description: "Analyze competitors and identify differentiators",
    category: "business",
    content: "Perform a competitive analysis:\n\nOur product/company: {{our_product}}\nCompetitors to analyze: {{competitors}}\n\nCompare on: features, pricing model, target market, strengths, and weaknesses. Identify gaps and opportunities.",
    variables: [
      { name: "our_product", description: "Your product or company description" },
      { name: "competitors", description: "Competitor names (comma-separated)" },
    ],
    systemPrompt: "You are a competitive intelligence analyst. Present comparisons in a structured table format where possible. Be objective and data-driven.",
  },

  // ── Development ──

  {
    name: "API Documentation",
    description: "Generate API documentation from an endpoint description",
    category: "development",
    content: "Write API documentation for the following endpoint:\n\nMethod: {{method}}\nPath: {{path}}\nDescription: {{description}}\nRequest body: {{request_body}}\nResponse: {{response}}\n\nInclude: description, parameters, request/response examples, error codes, and usage notes.",
    variables: [
      { name: "method", description: "HTTP method (GET, POST, etc.)" },
      { name: "path", description: "Endpoint path" },
      { name: "description", description: "What the endpoint does" },
      { name: "request_body", description: "Request body schema or example" },
      { name: "response", description: "Response schema or example" },
    ],
    systemPrompt: "You write clear API documentation in the style of Stripe or Twilio docs. Include realistic examples and common error scenarios.",
  },
  {
    name: "Unit Test Generator",
    description: "Generate unit tests for a given function or module",
    category: "development",
    content: "Write comprehensive unit tests for the following code:\n\n```{{language}}\n{{code}}\n```\n\nTest framework: {{framework}}\n\nCover: happy path, edge cases, error handling, and boundary conditions.",
    variables: [
      { name: "language", description: "Programming language" },
      { name: "code", description: "Code to test" },
      { name: "framework", description: "e.g. Jest, pytest, Go testing, JUnit" },
    ],
    systemPrompt: "You write thorough, well-organized unit tests. Use descriptive test names that explain the scenario. Follow the Arrange-Act-Assert pattern.",
  },
  {
    name: "Git Commit Message",
    description: "Write a conventional commit message from a diff",
    category: "development",
    content: "Write a git commit message for the following changes:\n\n```diff\n{{diff}}\n```\n\nFollow the Conventional Commits specification (type(scope): description).",
    variables: [{ name: "diff", description: "The git diff" }],
    systemPrompt: "You write concise, conventional commit messages. Focus on the 'why' in the body, not the 'what' (the diff shows the what). Keep the subject under 72 chars.",
  },
  {
    name: "Regex Builder",
    description: "Build and explain regular expressions",
    category: "development",
    content: "Create a regular expression that matches:\n\n{{description}}\n\nLanguage/flavor: {{flavor}}\n\nProvide the regex, an explanation of each part, and 3-5 test cases (matching and non-matching).",
    variables: [
      { name: "description", description: "What the regex should match" },
      { name: "flavor", description: "e.g. JavaScript, Python, PCRE" },
    ],
    systemPrompt: "You are a regex expert. Build readable, well-documented regular expressions. Prefer readability over cleverness. Always include test cases.",
  },
  {
    name: "Database Schema Design",
    description: "Design a database schema from requirements",
    category: "development",
    content: "Design a PostgreSQL database schema for:\n\n{{requirements}}\n\nInclude:\n- Table definitions with columns, types, and constraints\n- Primary and foreign keys\n- Indexes for common query patterns\n- Migration SQL",
    variables: [{ name: "requirements", description: "What the schema needs to support" }],
    systemPrompt: "You are a database architect. Design normalized schemas with proper constraints. Use UUIDs for primary keys, include timestamps, and consider soft deletes.",
  },

  // ── Productivity ──

  {
    name: "Decision Matrix",
    description: "Create a weighted decision matrix for comparing options",
    category: "productivity",
    content: "Create a decision matrix to compare the following options:\n\nDecision: {{decision}}\nOptions: {{options}}\nCriteria to evaluate: {{criteria}}\n\nWeight each criterion, score each option (1-5), and calculate totals. Provide a recommendation.",
    variables: [
      { name: "decision", description: "The decision to make" },
      { name: "options", description: "Options to compare (comma-separated)" },
      { name: "criteria", description: "Evaluation criteria (comma-separated)" },
    ],
    systemPrompt: "You facilitate structured decision-making. Present matrices in clean table format. Be transparent about trade-offs and assumptions behind scoring.",
  },
  {
    name: "Status Report",
    description: "Generate a weekly or monthly status report",
    category: "productivity",
    content: "Generate a {{period}} status report:\n\nProject/Team: {{project}}\nAccomplishments: {{accomplishments}}\nIn progress: {{in_progress}}\nBlockers: {{blockers}}\nNext period goals: {{next_goals}}",
    variables: [
      { name: "period", description: "weekly, biweekly, or monthly" },
      { name: "project", description: "Project or team name" },
      { name: "accomplishments", description: "What was completed" },
      { name: "in_progress", description: "Current work" },
      { name: "blockers", description: "Issues or risks" },
      { name: "next_goals", description: "Planned work for next period" },
    ],
    systemPrompt: "You write concise status reports. Use bullet points. Lead with impact, not activity. Quantify progress where possible.",
  },
  {
    name: "Interview Questions",
    description: "Generate role-specific interview questions",
    category: "productivity",
    content: "Generate interview questions for the following role:\n\nRole: {{role}}\nLevel: {{level}}\nKey skills: {{skills}}\nInterview type: {{type}}\n\nProvide 8-10 questions with follow-up probes and what to look for in answers.",
    variables: [
      { name: "role", description: "Job title" },
      { name: "level", description: "e.g. junior, senior, lead, manager" },
      { name: "skills", description: "Key skills to evaluate" },
      { name: "type", description: "e.g. technical, behavioral, system design" },
    ],
    systemPrompt: "You design effective interview questions. Focus on behavioral and situational questions that reveal real-world ability, not trivia. Include scoring rubrics.",
  },

  // ── Education ──

  {
    name: "Lesson Plan",
    description: "Create a structured lesson plan for any topic",
    category: "education",
    content: "Create a lesson plan for:\n\nTopic: {{topic}}\nAudience: {{audience}}\nDuration: {{duration}}\nLearning objectives: {{objectives}}",
    variables: [
      { name: "topic", description: "What to teach" },
      { name: "audience", description: "Who the learners are" },
      { name: "duration", description: "e.g. 30 minutes, 1 hour, 3 sessions" },
      { name: "objectives", description: "What learners should be able to do after" },
    ],
    systemPrompt: "You are an instructional designer. Create engaging lesson plans with clear learning outcomes, varied activities, and built-in checks for understanding.",
  },
  {
    name: "Study Guide",
    description: "Create a study guide from course material",
    category: "education",
    content: "Create a study guide from the following material:\n\n{{material}}\n\nInclude: key concepts with definitions, important relationships, common misconceptions, and 5 practice questions with answers.",
    variables: [{ name: "material", description: "Course content, notes, or textbook excerpts" }],
    systemPrompt: "You create effective study guides. Organize information hierarchically. Use mnemonics, analogies, and visual descriptions to aid retention.",
  },

  // ── Legal & Compliance ──

  {
    name: "Privacy Policy Review",
    description: "Analyze a privacy policy for GDPR/CCPA compliance gaps",
    category: "legal",
    content: "Review the following privacy policy for compliance with {{regulation}}:\n\n{{policy}}\n\nIdentify: missing required disclosures, unclear language, potential compliance gaps, and recommended changes.",
    variables: [
      { name: "regulation", description: "e.g. GDPR, CCPA, PIPEDA" },
      { name: "policy", description: "The privacy policy text" },
    ],
    systemPrompt: "You are a privacy compliance analyst. Flag specific compliance gaps with regulation references. Provide remediation language for each gap. Note: this is not legal advice.",
  },
  {
    name: "Contract Summary",
    description: "Summarize key terms and obligations from a contract",
    category: "legal",
    content: "Summarize the following contract:\n\n{{contract}}\n\nExtract: parties involved, key obligations, payment terms, duration, termination clauses, liability limitations, and any unusual or noteworthy provisions.",
    variables: [{ name: "contract", description: "The contract text" }],
    systemPrompt: "You summarize legal documents for business stakeholders. Use plain language. Highlight risks and obligations clearly. Note: this is not legal advice.",
  },

  // ── Data & Analysis ──

  {
    name: "Survey Designer",
    description: "Design an effective survey for gathering specific insights",
    category: "analysis",
    content: "Design a survey to gather insights on:\n\nTopic: {{topic}}\nTarget respondents: {{respondents}}\nGoal: {{goal}}\n\nInclude 10-15 questions with appropriate types (multiple choice, Likert scale, open-ended). Explain the reasoning behind each question.",
    variables: [
      { name: "topic", description: "What the survey is about" },
      { name: "respondents", description: "Who will take the survey" },
      { name: "goal", description: "What decisions will the data inform" },
    ],
    systemPrompt: "You design surveys that minimize bias and maximize actionable insights. Use neutral wording, logical flow, and appropriate question types.",
  },
  {
    name: "Data Cleaning Checklist",
    description: "Generate a data quality checklist for a dataset",
    category: "analysis",
    content: "Create a data cleaning and validation checklist for a dataset with the following structure:\n\nColumns: {{columns}}\nSource: {{source}}\nIntended use: {{use}}\n\nInclude checks for: completeness, consistency, accuracy, validity, and freshness.",
    variables: [
      { name: "columns", description: "Column names and types" },
      { name: "source", description: "Where the data comes from" },
      { name: "use", description: "How the cleaned data will be used" },
    ],
    systemPrompt: "You are a data quality specialist. Create practical, prioritized checklists. Include specific validation rules and SQL/Python snippets where helpful.",
  },

  // ── Communication ──

  {
    name: "Presentation Script",
    description: "Write a speaker script for a presentation",
    category: "communication",
    content: "Write a speaker script for a {{duration}} presentation:\n\nTopic: {{topic}}\nAudience: {{audience}}\nKey message: {{key_message}}\nSlide count: {{slides}}",
    variables: [
      { name: "duration", description: "e.g. 5 minutes, 15 minutes" },
      { name: "topic", description: "Presentation topic" },
      { name: "audience", description: "Who you're presenting to" },
      { name: "key_message", description: "The one thing the audience should remember" },
      { name: "slides", description: "Number of slides" },
    ],
    systemPrompt: "You write engaging presentation scripts. Structure with a hook, clear narrative arc, and strong close. Include timing cues and transition phrases.",
  },
  {
    name: "Incident Post-Mortem",
    description: "Structure an incident post-mortem report",
    category: "communication",
    content: "Write an incident post-mortem:\n\nIncident: {{incident}}\nImpact: {{impact}}\nTimeline: {{timeline}}\nRoot cause: {{root_cause}}\nResolution: {{resolution}}",
    variables: [
      { name: "incident", description: "What happened" },
      { name: "impact", description: "Who/what was affected and how" },
      { name: "timeline", description: "Key events with timestamps" },
      { name: "root_cause", description: "Why it happened" },
      { name: "resolution", description: "How it was fixed" },
    ],
    systemPrompt: "You write blameless post-mortems focused on learning. Structure: summary, impact, timeline, root cause analysis (use 5 Whys), action items with owners and deadlines.",
  },
  {
    name: "Change Announcement",
    description: "Draft an internal announcement for organizational changes",
    category: "communication",
    content: "Draft an internal announcement about:\n\n{{change}}\n\nAudience: {{audience}}\nTone: {{tone}}\nKey dates: {{dates}}\n\nAddress: what's changing, why, how it affects the audience, what they need to do, and where to ask questions.",
    variables: [
      { name: "change", description: "What is changing" },
      { name: "audience", description: "Who needs to know" },
      { name: "tone", description: "e.g. positive, neutral, sensitive" },
      { name: "dates", description: "Important dates and deadlines" },
    ],
    systemPrompt: "You write clear internal communications. Lead with the 'so what' for the reader. Be honest and direct. Anticipate questions and answer them proactively.",
  },
  {
    name: "Feedback Formatter",
    description: "Structure informal feedback into actionable format",
    category: "communication",
    content: "Take the following raw feedback and restructure it into clear, actionable format:\n\n{{feedback}}\n\nContext: {{context}}\n\nOrganize by theme. For each point: state the observation, explain the impact, and suggest a specific action.",
    variables: [
      { name: "feedback", description: "Raw feedback notes" },
      { name: "context", description: "e.g. performance review, project retro, peer feedback" },
    ],
    systemPrompt: "You structure feedback using the SBI (Situation-Behavior-Impact) model. Be constructive and specific. Balance positive reinforcement with growth areas.",
  },
];
