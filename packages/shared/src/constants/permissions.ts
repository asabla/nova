import type { Role } from "./roles";

export const PERMISSIONS = {
  "conversation.create": "member",
  "conversation.read": "viewer",
  "conversation.update": "member",
  "conversation.delete": "member",
  "conversation.share": "member",

  "agent.create": "power-user",
  "agent.read": "member",
  "agent.update": "power-user",
  "agent.delete": "power-user",
  "agent.publish": "power-user",

  "knowledge.create": "power-user",
  "knowledge.read": "member",
  "knowledge.update": "power-user",
  "knowledge.delete": "power-user",

  "files.upload": "member",
  "files.read": "viewer",
  "files.delete": "member",
  "files.admin": "org-admin",

  "workspace.create": "power-user",
  "workspace.read": "viewer",
  "workspace.update": "power-user",
  "workspace.delete": "power-user",

  "prompts.create": "member",
  "prompts.read": "viewer",
  "prompts.update": "member",
  "prompts.delete": "member",

  "users.manage": "org-admin",
  "groups.manage": "org-admin",
  "org.settings": "org-admin",
  "audit.read": "org-admin",
  "analytics.read": "org-admin",

  "orgs.manage": "super-admin",
  "system.health": "super-admin",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;
