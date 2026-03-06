import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { MessageSquarePlus, Search, Archive, Pin, Trash2, MoreHorizontal, ChevronLeft, Bot, BookOpen, FolderKanban, Settings, Sparkles, FileText, ShieldCheck, BarChart3, Code2, Microscope } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { useUIStore } from "../../stores/ui.store";
import { Button } from "../ui/Button";

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversationsData } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const conversations = conversationsData?.data ?? [];

  const filteredConversations = searchQuery
    ? conversations.filter((c: any) =>
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  return (
    <aside
      className={clsx(
        "flex flex-col h-full bg-surface-secondary border-r border-border transition-all duration-200",
        sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">NOVA</span>
        </div>
        <button onClick={toggleSidebar} className="text-text-tertiary hover:text-text p-1 rounded-lg hover:bg-surface-tertiary">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* New Conversation */}
      <div className="px-3 pt-3">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => navigate({ to: "/conversations/new" })}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {t("conversations.new")}
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder={t("conversations.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>
      </div>

      {/* Conversation List */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-text-tertiary">{t("conversations.empty")}</p>
            <p className="text-xs text-text-tertiary mt-1">{t("conversations.startPrompt")}</p>
          </div>
        ) : (
          filteredConversations.map((conv: any) => (
            <button
              key={conv.id}
              onClick={() => navigate({ to: `/conversations/${conv.id}` })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors group"
            >
              {conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
              <span className="truncate flex-1">{conv.title ?? "Untitled"}</span>
            </button>
          ))
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        <SidebarLink icon={Bot} label="Agents" to="/agents" />
        <SidebarLink icon={BookOpen} label="Knowledge" to="/knowledge" />
        <SidebarLink icon={FolderKanban} label="Workspaces" to="/workspaces" />
        <SidebarLink icon={FileText} label="Prompts" to="/prompts" />
        <SidebarLink icon={Microscope} label="Research" to="/research" />
        <SidebarLink icon={Code2} label="Playground" to="/playground" />
        <SidebarLink icon={BarChart3} label="Usage" to="/usage" />
        <SidebarLink icon={ShieldCheck} label="Admin" to="/admin" />
        <SidebarLink icon={Settings} label="Settings" to="/settings" />
      </div>
    </aside>
  );
}

function SidebarLink({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to })}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
