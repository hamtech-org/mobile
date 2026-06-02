import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback } from "react";

type TabBarNav = {
  getState(): { type?: string };
  getParent(): TabBarNav | undefined;
  setOptions(o: { tabBarStyle?: { display?: "none" } }): void;
};

function findTabNavigator(navigation: TabBarNav): TabBarNav | null {
  let parent: TabBarNav | undefined = navigation.getParent();
  while (parent) {
    if (parent.getState().type === "tab") {
      return parent;
    }
    parent = parent.getParent();
  }
  return null;
}

/** Ẩn/hiện tab bar chính (Tin nhắn, Live, …). Tự khôi phục khi rời màn hình. */
export function useHideMainTabBar(hide: boolean) {
  const navigation = useNavigation() as TabBarNav;

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
