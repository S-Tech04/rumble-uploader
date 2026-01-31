import { logout } from "./auth";

let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    } else {
      await logout();
      window.location.href = "/";
    }
  }
  
  return response;
};
