import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useLazyGetFeedQuery } from "@/store/api/newsfeedApi";
import type { IPost } from "@/types/newsfeed.types";
import { FEED_PAGE_SIZE } from "@/features/newsfeed/constants/newsfeed.constants";

const mergeDedupPosts = (previous: IPost[], incoming: IPost[]): IPost[] => {
  const merged = new Map(previous.map((post) => [post.postId, post]));
  for (const post of incoming) {
    merged.set(post.postId, post);
  }
  return Array.from(merged.values()).sort((a, b) => {
    const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;
    return b.postId.localeCompare(a.postId);
  });
};

export const useNewsfeedPagination = () => {
  const [triggerGetFeed] = useLazyGetFeedQuery();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const didBootstrapFeedRef = useRef(false);

  const fetchFeedPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (!replace && (!hasMore || isFetchingNext)) return;
      if (replace) setIsLoadingInitial(true);
      else setIsFetchingNext(true);

      try {
        const page = await triggerGetFeed(
          {
            limit: FEED_PAGE_SIZE,
            cursor,
          },
          true,
        ).unwrap();
        setPosts((prev) => (replace ? page.items : mergeDedupPosts(prev, page.items)));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch {
        if (replace) {
          setPosts([]);
          setNextCursor(null);
          setHasMore(false);
        }
      } finally {
        if (replace) setIsLoadingInitial(false);
        else setIsFetchingNext(false);
      }
    },
    [hasMore, isFetchingNext, triggerGetFeed],
  );

  useEffect(() => {
    if (!didBootstrapFeedRef.current) {
      didBootstrapFeedRef.current = true;
      void fetchFeedPage(null, true);
    }

    const createSubscription = DeviceEventEmitter.addListener("post:created", (newPost: IPost) => {
      setPosts((prev) => [newPost, ...prev]);
    });

    const deleteSubscription = DeviceEventEmitter.addListener("post:deleted", (postId: string) => {
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    });

    const updateSubscription = DeviceEventEmitter.addListener(
      "post:updated",
      (updatedPost: Partial<IPost>) => {
        setPosts((prev) =>
          prev.map((p) => (p.postId === updatedPost.postId ? { ...p, ...updatedPost } : p)),
        );
      },
    );

    return () => {
      createSubscription.remove();
      deleteSubscription.remove();
      updateSubscription.remove();
    };
  }, [fetchFeedPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetchingNext) return;
    void fetchFeedPage(nextCursor, false);
  }, [fetchFeedPage, hasMore, isFetchingNext, nextCursor]);

  return useMemo(
    () => ({
      posts,
      hasMore,
      isLoadingInitial,
      isFetchingNext,
      loadMore,
    }),
    [hasMore, isFetchingNext, isLoadingInitial, loadMore, posts],
  );
};
