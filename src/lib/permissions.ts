import type { Role } from "@prisma/client";

export type Permission =
  | "users:read"
  | "users:write"
  | "customers:read"
  | "customers:write"
  | "customers:delete"
  | "company:read"
  | "company:write"
  | "config:read"
  | "config:write"
  | "documents:read"
  | "documents:generate"
  | "documents:delete"
  | "audit:read";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "users:read", "users:write",
    "customers:read", "customers:write", "customers:delete",
    "company:read", "company:write",
    "config:read", "config:write",
    "documents:read", "documents:generate", "documents:delete",
    "audit:read",
  ],
  ADMIN: [
    "customers:read", "customers:write", "customers:delete",
    "company:read", "company:write",
    "config:read", "config:write",
    "documents:read", "documents:generate", "documents:delete",
    "audit:read",
  ],
  STAFF: [
    "customers:read", "customers:write",
    "company:read",
    "config:read",
    "documents:read", "documents:generate",
  ],
  VIEWER: [
    "customers:read",
    "company:read",
    "documents:read",
  ],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role | undefined | null, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
