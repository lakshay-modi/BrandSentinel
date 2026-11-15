// Pulls numbers with units out of text so they can be compared with the Fact Bank.

export interface NumberToken {
  text: string;
  index: number;
  value: number;
  unit: string; // canonical: ₹ g mg ml l kcal % cities stores km kg mAh kWh GB TB Mbps h
}

const UNIT_MAP: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g",
  mg: "mg", ml: "ml", l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  kcal: "kcal", cal: "kcal", calories: "kcal", calorie: "kcal",
  "%": "%", cities: "cities", city: "cities", stores: "stores", store: "stores", outlets: "stores",
  // product specs (bikes, electronics, appliances)
  km: "km", kms: "km", kilometre: "km", kilometres: "km", kilometer: "km", kilometers: "km",
  kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg",
  mah: "mAh", kwh: "kWh", gb: "GB", tb: "TB", mbps: "Mbps",
  h: "h", hr: "h", hrs: "h", hour: "h", hours: "h",
};

const RE =
  /(₹\s?|\brs\.?\s?|\binr\s?)?(\d[\d,]*(?:\.\d+)?)(\+)?\s?(%|(?:gms|gm|grams|gram|g|mg|ml|litres|litre|liters|liter|l|kcal|calories|calorie|cal|cities|city|stores|store|outlets|kilometres|kilometers|kilometre|kilometer|kms|km|kilograms|kilogram|kgs|kg|mah|kwh|gb|tb|mbps|hours|hour|hrs|hr|h)\b)?/gi;

// counts may have a word or two before the unit: "12 Indian cities", "2,000+ partner stores"
const COUNT_RE = /(\d[\d,]*)(\+)?\s+(?:[A-Za-z]+\s+){1,2}?(cities|city|stores|store|outlets)\b/gi;

export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of text.matchAll(COUNT_RE)) {
    // a number glued to a word (e.g. "KIRO10 at any store") is part of a code, not a count
    if (/[A-Za-z]/.test(text[(m.index ?? 0) - 1] ?? "")) continue;
    const value = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isNaN(value)) out.push({ text: m[0].trim(), index: m.index ?? 0, value, unit: UNIT_MAP[m[3].toLowerCase()] });
  }
  for (const m of text.matchAll(RE)) {
    const [whole, currency, num, , unitRaw] = m;
    const value = parseFloat(num.replace(/,/g, ""));
    let unit: string | null = null;
    if (currency) unit = "₹";
    else if (unitRaw) unit = UNIT_MAP[unitRaw.toLowerCase()] ?? null;
    if (!unit || Number.isNaN(value)) continue;
    // a number glued to a word (e.g. "OATVIA20") is not a quantity
    const before = text[(m.index ?? 0) - 1];
    if (!currency && before && /[A-Za-z]/.test(before)) continue;
    if (out.some((o) => o.index === (m.index ?? 0))) continue;
    out.push({ text: whole.trim(), index: m.index ?? 0, value, unit });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function sameNumber(a: NumberToken, b: NumberToken): boolean {
  return a.unit === b.unit && Math.abs(a.value - b.value) < 1e-9;
}
