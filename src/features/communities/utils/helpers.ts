import { type CommunityMemberRole } from "@/types/community.types";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function canManage(role?: CommunityMemberRole | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}
