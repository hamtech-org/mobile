import { useMemo, useState } from "react";
import type { IPost } from "@/types/newsfeed.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";

export const useNewsfeedSearch = (posts: IPost[]) => {
  const [query, setQuery] = useState("");

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const text = extractTextFromTiptapJson(post.content).toLowerCase();
      return (
        text.includes(q) ||
        post.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        post.categories?.some((category) => category.toLowerCase().includes(q))
      );
    });
  }, [posts, query]);

  return {
    query,
    setQuery,
    filteredPosts,
  };
};
