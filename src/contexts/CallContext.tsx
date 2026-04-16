import { createContext, useContext, type PropsWithChildren } from "react";

interface CallContextValue {
  inCall: boolean;
}

const CallContext = createContext<CallContextValue>({ inCall: false });

export const CallProvider = ({ children }: PropsWithChildren) => {
  return <CallContext.Provider value={{ inCall: false }}>{children}</CallContext.Provider>;
};

export const useCallContext = () => useContext(CallContext);
