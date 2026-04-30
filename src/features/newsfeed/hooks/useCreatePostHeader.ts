import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

export const useCreatePostHeader = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const createPostName = currentUser?.displayName?.trim() || "Bạn";
  const createPostAvatar = currentUser?.avatar ?? "";
  const createPostInitial = createPostName.charAt(0).toUpperCase() || "U";

  return {
    createPostName,
    createPostAvatar,
    createPostInitial,
  };
};
