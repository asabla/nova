import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Compass, MessageSquare, Code2, Microscope, Palette, BarChart3, Bot } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/explore")({
  component: ExplorePage,
});

const SAMPLE_CONVERSATIONS = [
  {
    category: "General",
    icon: MessageSquare,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    items: [
      { title: "Explain quantum computing", prompt: "Explain quantum computing in simple terms. What makes it different from classical computing, and what are the most promising applications?" },
      { title: "Plan a healthy meal", prompt: "Help me plan a balanced, healthy dinner for 4 people. Include a main course, side dish, and dessert. Consider dietary variety and nutrition." },
      { title: "Write a travel itinerary", prompt: "Create a 5-day travel itinerary for Tokyo, Japan. Include must-see attractions, local food recommendations, and transportation tips." },
    ],
  },
  {
    category: "Code & Development",
    icon: Code2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    items: [
      { title: "Debug a React component", prompt: "I have a React component that re-renders too often. Help me identify common causes of unnecessary re-renders and how to optimize with useMemo, useCallback, and React.memo." },
      { title: "Design a REST API", prompt: "Help me design a REST API for a blog platform. I need endpoints for posts, comments, users, and tags. Include proper HTTP methods, status codes, and pagination." },
      { title: "Write unit tests", prompt: "Show me how to write comprehensive unit tests for a TypeScript function that validates email addresses. Use best practices for test structure and edge cases." },
    ],
  },
  {
    category: "Research & Analysis",
    icon: Microscope,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    items: [
      { title: "Compare AI frameworks", prompt: "Compare PyTorch, TensorFlow, and JAX for machine learning research. Consider ease of use, performance, ecosystem, and best use cases for each." },
      { title: "Analyze market trends", prompt: "Analyze the current trends in the SaaS industry for 2026. What are the key growth areas, challenges, and opportunities for new startups?" },
      { title: "Literature review helper", prompt: "Help me structure a literature review on the topic of 'Large Language Models in Education'. What are the key themes, methodologies, and findings I should cover?" },
    ],
  },
  {
    category: "Creative Writing",
    icon: Palette,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    items: [
      { title: "Write a short story", prompt: "Write a short science fiction story (500 words) about a world where AI and humans have developed a symbiotic relationship. Focus on the emotional aspects." },
      { title: "Draft a blog post", prompt: "Help me draft a blog post about 'The Future of Remote Work'. Include an engaging introduction, 3-4 key points, and a conclusion with a call to action." },
      { title: "Create a poem", prompt: "Write a poem about the changing of seasons, using vivid imagery and metaphors. Style it as a modern take on traditional nature poetry." },
    ],
  },
  {
    category: "Data & Analysis",
    icon: BarChart3,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    items: [
      { title: "Explain statistical concepts", prompt: "Explain the difference between correlation and causation with real-world examples. Include common pitfalls in data interpretation." },
      { title: "SQL query optimization", prompt: "I have a slow SQL query that joins 5 tables and aggregates data. Show me techniques to optimize it: indexing strategies, query restructuring, and CTEs." },
    ],
  },
];

function ExplorePage() {
  const navigate = useNavigate();

  const handleStartConversation = async (title: string, prompt: string) => {
    try {
      const conv = await api.post<any>("/api/conversations", { title });
      await api.post(`/api/conversations/${conv.id}/messages`, {
        content: prompt,
        senderType: "user",
      });
      navigate({ to: `/conversations/${conv.id}` });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create conversation");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Compass className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-text">Explore</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Discover what NOVA can do. Click any example to start a conversation.
        </p>
      </div>

      {SAMPLE_CONVERSATIONS.map((category) => (
        <div key={category.category}>
          <div className="flex items-center gap-2 mb-3">
            <category.icon className={`h-4 w-4 ${category.color}`} />
            <h2 className="text-sm font-medium text-text">{category.category}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {category.items.map((item) => (
              <button
                key={item.title}
                onClick={() => handleStartConversation(item.title, item.prompt)}
                className="text-left p-4 rounded-xl border border-border bg-surface-secondary hover:bg-surface-secondary/80 hover:border-primary/30 transition-all group"
              >
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${category.bg} mb-2`}>
                  <category.icon className={`h-4 w-4 ${category.color}`} />
                </div>
                <p className="text-sm font-medium text-text mb-1 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-text-tertiary line-clamp-2">{item.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
