import { createContext, useContext, useState } from "react";

const GlobalContext = createContext();

export function GlobalProvider({ children }) {
  const [userInterest, setUserInterest] = useState("");

  return (
    <GlobalContext.Provider value={{ userInterest, setUserInterest }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  return useContext(GlobalContext);
}
