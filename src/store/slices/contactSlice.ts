import { createSlice } from "@reduxjs/toolkit";

interface ContactState {
  ready: boolean;
}

const initialState: ContactState = {
  ready: false,
};

const contactSlice = createSlice({
  name: "contact",
  initialState,
  reducers: {},
});

export const contactReducer = contactSlice.reducer;
