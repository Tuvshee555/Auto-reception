/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";

export default function AdminForm() {
  const [state, setState] = useState({
    name: "",
    address: "",
    hours: "",
    services: "",
  });

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/admin/settings");
      if (r.ok) {
        const j = await r.json();
        setState({
          name: j.name || "",
          address: j.address || "",
          hours: j.hours || "",
          services: (j.services || []).join("\n"),
        });
      }
    }
    load();
  }, []);

  async function save(e?: any) {
    e?.preventDefault();
    await fetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ ...state, services: state.services.split("\n") }),
      headers: { "Content-Type": "application/json" },
    });
    alert("saved");
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <label>Business name</label>
      <input
        value={state.name}
        onChange={(e) => setState({ ...state, name: e.target.value })}
        className="w-full p-2 border rounded"
      />
      <label>Address</label>
      <input
        value={state.address}
        onChange={(e) => setState({ ...state, address: e.target.value })}
        className="w-full p-2 border rounded"
      />
      <label>Hours</label>
      <input
        value={state.hours}
        onChange={(e) => setState({ ...state, hours: e.target.value })}
        className="w-full p-2 border rounded"
      />
      <label>Services (one per line, format: Service — Price)</label>
      <textarea
        value={state.services}
        onChange={(e) => setState({ ...state, services: e.target.value })}
        className="w-full p-2 border rounded h-40"
      />
      <div>
        <button className="px-4 py-2 border rounded">Save</button>
      </div>
    </form>
  );
}
