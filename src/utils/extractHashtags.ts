/**
 * Extract #hashtag tokens from a Tiptap JSON content string.
 *
 * Walks every text node and pulls words that start with `#`.
 * Returns a deduplicated, lowercased array of tag names (without the `#` prefix).
 */

const collectTextNodes = (node: unknown): string[] => {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(collectTextNodes);
  if (typeof node !== "object") return [];

  const obj = node as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.text === "string") return [obj.text];
  if ("content" in obj) return collectTextNodes(obj.content);
  return [];
};

const HASHTAG_RE = /(?:^|\s)#(\w[\w\d_]*)/g;

export const extractHashtags = (tiptapJsonString: string): string[] => {
  try {
    const parsed = JSON.parse(tiptapJsonString) as unknown;
    const allText = collectTextNodes(parsed).join(" ");
    const tags = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = HASHTAG_RE.exec(allText)) !== null) {
      tags.add(match[1].toLowerCase());
    }

    return Array.from(tags);
  } catch {
    return [];
  }
};
