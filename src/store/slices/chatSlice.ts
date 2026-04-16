import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  activeConversationId: string | null;
}

const initialState: ChatState = {
  activeConversationId: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActiveConversationId: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
    },
  },
});

export const { setActiveConversationId } = chatSlice.actions;
export const chatReducer = chatSlice.reducer;
