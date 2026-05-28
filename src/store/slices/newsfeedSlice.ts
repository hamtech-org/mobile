import { createSlice } from "@reduxjs/toolkit";

interface NewsfeedState {
  ready: boolean;
}

const initialState: NewsfeedState = {
  ready: false,
};

const newsfeedSlice = createSlice({
  name: "newsfeed",
  initialState,
  reducers: {},
});

export const newsfeedReducer = newsfeedSlice.reducer;
