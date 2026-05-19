import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import "./index.css";

/**
 * Provider order matters:
 *   BrowserRouter → so AuthProvider can react to route changes if we want to
 *                   later (e.g. analytics on sign-in).
 *   ThemeProvider → outside Auth so unauthenticated screens still get themed.
 *   AuthProvider  → wraps <App /> so every route can call useAuth().
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
