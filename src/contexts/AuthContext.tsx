import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  phoneNumber: string;
  name: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, name?: string, email?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'auth_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage - persist forever (no expiry)
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          // Restore user session (no expiry check - stay logged in forever)
          setUser({
            phoneNumber: session.phoneNumber,
            name: session.name || `User ${session.phoneNumber}`,
            email: session.email,
          });
        } catch (e) {
          console.warn("Failed to parse session data:", e);
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (e) {
      console.warn("Failed to access localStorage:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (phoneNumber: string, name?: string, email?: string) => {
    const userData: User = {
      phoneNumber,
      name: name || `User ${phoneNumber}`,
      email,
    };
    setUser(userData);
    
    // Store session in localStorage forever (no expiry)
    const session = {
      ...userData,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
