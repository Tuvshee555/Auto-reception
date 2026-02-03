import { useState, useEffect } from "react";

type Booking = {
  _id?: string;
  name?: string;
  senderId?: string;
  phone?: string;
  service?: string;
  date?: string;
  createdAt?: string;
  status?: string;
};

type Props = { adminToken?: string };

export default function BookingList({ adminToken }: Props) {
  const [list, setList] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/admin/bookings", {
          headers: adminToken ? { "x-admin-token": adminToken } : undefined,
        });
        if (!r.ok) throw new Error(`Load failed (${r.status})`);
        setList(await r.json());
        setError("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load bookings",
        );
      }
    }
    load();
  }, [adminToken]);

  return (
    <div>
      <h2 className="text-lg mb-2">Bookings</h2>
      {error ? <div className="text-red-600 mb-2">{error}</div> : null}
      <div className="space-y-2">
        {list.map((b) => (
          <div key={b._id} className="p-2 border rounded">
            <div>
              <strong>{b.name || b.senderId}</strong>
            </div>
            <div>{b.phone}</div>
            <div>{b.service}</div>
            <div>
              {b.date || b.createdAt
                ? new Date(b.date ?? b.createdAt ?? "").toLocaleString()
                : "—"}
            </div>
            <div>Status: {b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
