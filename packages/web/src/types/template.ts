import type { LucideIcon } from "lucide-react";

export interface TemplateInput {
  id: string;
  type: "text" | "textarea" | "file";
  label: string;
  placeholder: string;
  required: boolean;
  accept?: string;
}

/** Template as returned from the API (icon is a string name). */
export interface ApiTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[] | null;
  inputs: TemplateInput[] | null;
  icon: string | null;
  color: string | null;
  bgColor: string | null;
  isSystem: boolean;
  usageCount: number;
  sortOrder?: number;
}

/** Template with the icon resolved to a React component (ready for rendering). */
export interface ExploreTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  inputs?: TemplateInput[];
  icon: LucideIcon;
  color: string;
  bgColor: string;
  isSystem: boolean;
}
