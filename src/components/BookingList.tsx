/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";

export default function BookingList() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      const r = await fetch("/api/admin/bookings");
      if (!r.ok) return;
      setList(await r.json());
    }
    load();
  }, []);

  return (
    <div>
      <h2 className="text-lg mb-2">Bookings</h2>
      <div className="space-y-2">
        {list.map((b) => (
          <div key={b._id} className="p-2 border rounded">
            <div>
              <strong>{b.name || b.senderId}</strong>
            </div>
            <div>{b.phone}</div>
            <div>{b.service}</div>
            <div>{new Date(b.date || b.createdAt).toLocaleString()}</div>
            <div>Status: {b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
