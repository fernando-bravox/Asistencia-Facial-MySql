import React from "react";

export default function Toast({ type = "ok", message }) {
  if (!message) return null;
  return <div className={`toast ${type === "err" ? "err" : "ok"}`}>{message}</div>;
}
