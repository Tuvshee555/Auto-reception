/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";

export default function DemoChat() {
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);
  const [input, setInput] = useState("");

  async function send() {
    if (!input) return;
    setMessages((s) => [...s, { from: "user", text: input }]);
    const text = input;
    setInput("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });
      const j = await r.json();
      setMessages((s) => [...s, { from: "bot", text: j.reply || "..." }]);
    } catch (e) {
      setMessages((s) => [...s, { from: "bot", text: "server error" }]);
    }
  }

  return (
    <div>
      <div className="border rounded p-4 h-80 overflow-auto mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.from === "user" ? "text-right" : "text-left"}
          >
            <div className="inline-block p-2 my-1 rounded bg-gray-100">
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="shudnii tsag avah..."
        />
        <button onClick={send} className="p-2 border rounded">
          Send
        </button>
      </div>
    </div>
  );
}
