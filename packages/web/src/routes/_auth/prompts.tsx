import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, Search, Copy, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Badge } from "../../components/ui/Badge";

export const Route = createFileRoute("/_auth/prompts")({
  component: PromptsPage,
});

function PromptsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: promptsData } = useQuery({
    queryKey: ["prompts", search],
    queryFn: () => api.get<any>(`/api/prompts?search=${encodeURIComponent(search)}`),
  });

  const deletePrompt = useMutation({
    mutationFn: (id: string) => api.delete(`/api/prompts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts"] }),
  });

  const prompts = (promptsData as any)?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Prompt Library</h1>
            <p className="text-sm text-text-secondary mt-1">Save and share reusable prompt templates</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-surface-secondary border border-border text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>

        {prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text mb-2">No prompt templates</h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              Create reusable templates with variables to speed up your workflows.
            </p>
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create your first template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prompts.map((p: any) => (
              <div key={p.id} className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text">{p.name}</h3>
                  {p.category && <Badge variant="default">{p.category}</Badge>}
                </div>
                <p className="text-xs text-text-tertiary mb-3 line-clamp-2">{p.description ?? "No description"}</p>
                <pre className="text-xs bg-surface border border-border rounded-lg p-2 mb-3 overflow-hidden max-h-20 text-text-secondary font-mono">
                  {p.content?.slice(0, 200)}
                </pre>
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => navigator.clipboard.writeText(p.content)}
                    className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deletePrompt.mutate(p.id)}
                    className="text-text-tertiary hover:text-danger p-1 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <CreatePromptDialog open={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    </div>
  );
}

function CreatePromptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const create = useMutation({
    mutationFn: (data: any) => api.post("/api/prompts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      onClose();
      setName("");
      setDescription("");
      setContent("");
      setCategory("");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Create Prompt Template">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, description: description || undefined, content, category: category || undefined });
        }}
        className="space-y-4"
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., coding, writing, analysis" />
        <div>
          <label className="block text-sm font-medium text-text mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
            placeholder="Use {{variable}} for template variables..."
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none font-mono"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Dialog>
  );
}
