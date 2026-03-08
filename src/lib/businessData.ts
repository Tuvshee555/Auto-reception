import { promises as fs } from "fs";
import path from "path";

export type BusinessSettings = {
  name?: string;
  phone?: string;
  address?: string;
  hours?: string;
  services?: string;
  prices?: string;
  links?: string;
};

export type BusinessDataFile = {
  systemPrompt?: string;
  business?: BusinessSettings;
};

const DATA_PATH = path.join(process.cwd(), "data", "business.json");

const DEFAULT_DATA: BusinessDataFile = {
  systemPrompt:
    "Be friendly. Provide accurate business info and help users book appointments.",
  business: {
    name: "Clinic",
    phone: "86868686",
    address: "ulaanbatar",
    hours: "9:00-18:00",
    services: "help with health",
    prices: "500 to 1000",
    links: "https://example.com",
  },
};

export async function readBusinessData(): Promise<BusinessDataFile> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as BusinessDataFile;
    return {
      ...DEFAULT_DATA,
      ...parsed,
      business: {
        ...DEFAULT_DATA.business,
        ...(parsed.business || {}),
      },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

export async function writeBusinessData(next: BusinessDataFile) {
  const merged: BusinessDataFile = {
    ...DEFAULT_DATA,
    ...next,
    business: {
      ...DEFAULT_DATA.business,
      ...(next.business || {}),
    },
  };
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(merged, null, 2), "utf8");
}
