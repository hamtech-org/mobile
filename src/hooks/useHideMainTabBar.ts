import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback } from "react";

function findTabNavigator(navigation: ReturnType<typeof useNavigation>): {
  setOptions: (o: { tabBarStyle?: { display?: "none" | "flex" } }) => void;
} | null {
  let parent = navigation.getParent() as ReturnType<typeof useNavigation> | undefined;
  while (parent) {
    const state = parent.getState?.();
    if (state?.type === "tab") {
      return parent as { setOptions: (o: { tabBarStyle?: { display?: "none" | "flex" } }) => void };
    }
    parent = parent.getParent?.() as typeof parent;
  }
  return null;
}

/** Ẩn/hiện tab bar chính (Tin nhắn, Live, …). Tự khôi phục khi rời màn hình. */
export function useHideMainTabBar(hide: boolean) {
  const navigation = useNavigation();

  const setTabBarHidden = useCallback(
    (hidden: boolean) => {
      const tabNav = findTabNavigator(navigation);
      tabNav?.setOptions({
        tabBarStyle: hidden ? { display: "none" } : undefined,
      });
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(hide);
      return () => setTabBarHidden(false);
    }, [hide, setTabBarHidden]),
  );
}
