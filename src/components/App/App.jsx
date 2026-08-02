import "./App.css";
import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { GlobalProvider } from "../GlobalState/GlobalState";

const App = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <GlobalProvider>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </GlobalProvider>
  );
};
export default App;
