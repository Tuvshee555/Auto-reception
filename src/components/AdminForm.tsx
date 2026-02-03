import { useState, useEffect } from "react";

const EMPTY_STATE = {
  name: "",
  address: "",
  hours: "",
  services: "",
};

type AdminSettings = typeof EMPTY_STATE;

type LoadState = {
  loading: boolean;
  saving: boolean;
  error: string;
  success: string;
};

type ValidationErrors = {
  name?: string;
  address?: string;
  hours?: string;
  services?: string;
};

function validate(state: AdminSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!state.name.trim()) errors.name = "Business name is required.";
  if (!state.address.trim()) errors.address = "Address is required.";
  if (!state.hours.trim()) errors.hours = "Hours are required.";

  const services = state.services
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (services.length === 0) {
    errors.services = "Add at least one service.";
  }

  return errors;
}

type Props = { adminToken?: string };

export default function AdminForm({ adminToken }: Props) {
  const [state, setState] = useState<AdminSettings>(EMPTY_STATE);
  const [status, setStatus] = useState<LoadState>({
    loading: true,
    saving: false,
    error: "",
    success: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const r = await fetch("/api/admin/settings", {
          headers: adminToken ? { "x-admin-token": adminToken } : undefined,
        });
        if (!r.ok) {
          throw new Error(`Load failed (${r.status})`);
        }
        const j = await r.json();
        if (!isMounted) return;
        setState({
          name: j.name || "",
          address: j.address || "",
          hours: j.hours || "",
          services: (j.services || []).join("\n"),
        });
        setStatus((s) => ({ ...s, loading: false, error: "" }));
      } catch (err) {
        if (!isMounted) return;
        setStatus((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load settings",
        }));
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [adminToken]);

  async function save(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();

    const nextErrors = validate(state);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus((s) => ({
        ...s,
        error: "Please fix the highlighted fields.",
        success: "",
      }));
      return;
    }

    setStatus((s) => ({ ...s, saving: true, error: "", success: "" }));

    const services = state.services
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;

      const r = await fetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ ...state, services }),
        headers,
      });

      if (!r.ok) {
        throw new Error(`Save failed (${r.status})`);
      }

      setStatus((s) => ({ ...s, saving: false, success: "Saved" }));
    } catch (err) {
      setStatus((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save settings",
      }));
    }
  }

  const disabled = status.loading || status.saving;

  return (
    <form onSubmit={save} className="space-y-3" aria-busy={status.loading}>
      <label>Business name</label>
      <input
        value={state.name}
        onChange={(e) => {
          setState({ ...state, name: e.target.value });
          if (errors.name) setErrors({ ...errors, name: undefined });
        }}
        className="w-full p-2 border rounded"
        disabled={disabled}
        aria-invalid={Boolean(errors.name)}
      />
      {errors.name ? <div className="text-red-600">{errors.name}</div> : null}

      <label>Address</label>
      <input
        value={state.address}
        onChange={(e) => {
          setState({ ...state, address: e.target.value });
          if (errors.address) setErrors({ ...errors, address: undefined });
        }}
        className="w-full p-2 border rounded"
        disabled={disabled}
        aria-invalid={Boolean(errors.address)}
      />
      {errors.address ? (
        <div className="text-red-600">{errors.address}</div>
      ) : null}

      <label>Hours</label>
      <input
        value={state.hours}
        onChange={(e) => {
          setState({ ...state, hours: e.target.value });
          if (errors.hours) setErrors({ ...errors, hours: undefined });
        }}
        className="w-full p-2 border rounded"
        disabled={disabled}
        aria-invalid={Boolean(errors.hours)}
      />
      {errors.hours ? <div className="text-red-600">{errors.hours}</div> : null}

      <label>Services (one per line, format: Service - Price)</label>
      <textarea
        value={state.services}
        onChange={(e) => {
          setState({ ...state, services: e.target.value });
          if (errors.services) setErrors({ ...errors, services: undefined });
        }}
        className="w-full p-2 border rounded h-40"
        disabled={disabled}
        aria-invalid={Boolean(errors.services)}
      />
      {errors.services ? (
        <div className="text-red-600">{errors.services}</div>
      ) : null}

      {status.error ? <div className="text-red-600">{status.error}</div> : null}
      {status.success ? (
        <div className="text-green-700">{status.success}</div>
      ) : null}
      <div>
        <button className="px-4 py-2 border rounded" disabled={disabled}>
          {status.saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
