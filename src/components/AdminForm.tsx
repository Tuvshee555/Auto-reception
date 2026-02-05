/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";

export default function AdminForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    hours: "",
    services: "",
    prices: "",
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => setForm({ ...form, ...data }));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function save() {
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Business Settings</h2>

      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Business Name"
        className="w-full p-2 border rounded"
      />
      <input
        name="phone"
        value={form.phone}
        onChange={handleChange}
        placeholder="Phone Number"
        className="w-full p-2 border rounded"
      />
      <input
        name="address"
        value={form.address}
        onChange={handleChange}
        placeholder="Address"
        className="w-full p-2 border rounded"
      />
      <input
        name="hours"
        value={form.hours}
        onChange={handleChange}
        placeholder="Working Hours"
        className="w-full p-2 border rounded"
      />

      <textarea
        name="services"
        value={form.services}
        onChange={handleChange}
        placeholder="Services"
        className="w-full p-2 border rounded"
      />
      <textarea
        name="prices"
        value={form.prices}
        onChange={handleChange}
        placeholder="Prices"
        className="w-full p-2 border rounded"
      />

      <button onClick={save} className="px-4 py-2 border rounded">
        Save
      </button>
      {saved && <div className="text-green-600">Saved ✓</div>}
    </div>
  );
}
