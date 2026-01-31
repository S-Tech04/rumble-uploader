import { useState, useEffect } from "react";
import LoginScreen from "@/components/LoginScreen";
import MainApp from "@/components/MainApp";

const Index = () => {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("authToken");
  };

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <MainApp token={token} onLogout={handleLogout} />;
};

export default Index;
