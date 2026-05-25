import { type CommunityCategory, type CommunityMemberRole } from "@/types/community.types";

export const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  general: "Chung",
  technology: "Công nghệ",
  sports: "Thể thao",
  music: "Nhạc",
  education: "Giáo dục",
  gaming: "Gaming",
  lifestyle: "Đời sống",
};

export const ROLE_LABEL: Record<CommunityMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Mod",
  member: "Member",
};

export const TABS = ["posts", "about"] as const;
export type TabKey = (typeof TABS)[number];
