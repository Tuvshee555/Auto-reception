import { useEffect, useState } from "react";
import AdminForm from "../components/AdminForm";
import BookingList from "../components/BookingList";

export default function Admin() {
  const [tokenInput, setTokenInput] = useState("");
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">(
    "checking",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const r = await fetch("/api/admin/login", { method: "GET" });
        setStatus(r.ok ? "unlocked" : "locked");
      } catch {
        setStatus("locked");
      }
    }
    check();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });
    if (r.ok) {
      setStatus("unlocked");
      setTokenInput("");
    } else {
      setError("Invalid token");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setStatus("locked");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Admin – Business Settings</h1>

      {status === "checking" ? (
        <div>Checking access…</div>
      ) : status === "locked" ? (
        <form onSubmit={handleLogin} className="space-y-3 max-w-md">
          <label>Enter admin access token</label>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Admin token"
          />
          {error && <div className="text-red-600">{error}</div>}
          <button className="px-4 py-2 border rounded">Unlock</button>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <AdminForm />
          </div>
          <div>
            <BookingList />
          </div>
          <div className="md:col-span-2">
            <button
              className="px-3 py-1 border rounded text-sm"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
