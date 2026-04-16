import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type ThemeMode = "system" | "light" | "dark";

interface UiState {
  themeMode: ThemeMode;
}

const initialState: UiState = {
  themeMode: "system",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
    },
  },
});

export const { setThemeMode } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
