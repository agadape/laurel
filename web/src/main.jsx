import { Buffer } from "buffer";
if (typeof window !== "undefined" && !window.Buffer) window.Buffer = Buffer; // NEAR wallet SDKs expect Node's Buffer
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(<App />);
