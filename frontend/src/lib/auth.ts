let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });

  failedQueue = [];
};

export const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    const response = await fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.accessToken) {
      localStorage.setItem("authToken", data.accessToken);
      return data.accessToken;
    } else {
      throw new Error(data.error || "Token refresh failed");
    }
  } catch (error) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    throw error;
  }
};

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem("authToken");

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const data = await response.json();
    
    if (data.expired) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            headers.Authorization = `Bearer ${token}`;
            return fetch(url, { ...options, headers });
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        headers.Authorization = `Bearer ${newToken}`;
        return fetch(url, { ...options, headers });
      } catch (error) {
        processQueue(error as Error, null);
        window.location.href = "/";
        throw error;
      } finally {
        isRefreshing = false;
      }
    }
  }

  return response;
};

export const logout = async () => {
  const refreshToken = localStorage.getItem("refreshToken");

  if (refreshToken) {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
};
