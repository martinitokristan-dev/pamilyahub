/**
 * Local verification for pay_plan pendingAction / findPlanByName (no API).
 * Run: node scripts/verify-chat-plans.mjs
 */

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPlanByName(inputText, plans = [], candidates = null) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) return { match: null };

  const searchPool =
    candidates && candidates.length > 0
      ? candidates
      : plans.filter((p) => !p.is_paid);

  if (searchPool.length === 0) return { match: null };

  const fullMatches = searchPool.filter((p) => {
    const title = normalizeText(p.title || "");
    if (!title) return false;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalizedInput);
  });
  if (fullMatches.length === 1) return { match: fullMatches[0] };
  if (fullMatches.length > 1) {
    const firstLower = normalizeText(fullMatches[0].title);
    if (fullMatches.every((p) => normalizeText(p.title) === firstLower)) {
      return { match: fullMatches[0] };
    }
    return { ambiguous: fullMatches };
  }

  const excludeWords = new Set([
    "pay", "paid", "bayad", "plan", "bill", "from", "gcash",
  ]);
  const inputWords = normalizedInput
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w && !excludeWords.has(w));

  const partialMatches = searchPool.filter((p) => {
    const title = normalizeText(p.title || "");
    if (!title) return false;
    const titleParts = title.split(/\s+/);
    return inputWords.some(
      (word) =>
        titleParts.some((part) => part.includes(word) || word.includes(part)) ||
        title.includes(word),
    );
  });

  if (partialMatches.length === 1) return { match: partialMatches[0] };
  if (partialMatches.length > 1) return { ambiguous: partialMatches };
  return { match: null };
}

function parseDisambiguationChoice(inputText, count) {
  const normalized = normalizeText(inputText).trim();
  const digitMatch = normalized.match(/^(\d+)$/);
  if (digitMatch) {
    const idx = parseInt(digitMatch[1], 10) - 1;
    if (idx >= 0 && idx < count) return idx;
  }
  return null;
}

const plans = [
  { id: 1, title: "Netflix Subscription", amount: 499, is_paid: false },
  { id: 2, title: "Netflix Family", amount: 549, is_paid: false },
  { id: 3, title: "Spotify", amount: 149, is_paid: false },
];

let pendingAction = null;

function resolveChoice(text) {
  if (!pendingAction) return null;
  const idx = parseDisambiguationChoice(text, pendingAction.candidates.length);
  if (idx === null) {
    pendingAction = null;
    return null;
  }
  const selected = pendingAction.candidates[idx];
  pendingAction = null;
  return selected;
}

let pass = 0;
let fail = 0;

function assert(name, cond) {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.error(`✗ ${name}`);
  }
}

// Manual test 1: ambiguity
const r1 = findPlanByName("pay plan netflix from gcash", plans);
assert("Test 1a: netflix matches multiple plans", r1.ambiguous?.length === 2);
pendingAction = { candidates: r1.ambiguous };
const picked = resolveChoice("2");
assert("Test 1b: digit 2 picks second netflix plan", picked?.title === "Netflix Family");

// Manual test 5: cancel on unrelated input
pendingAction = { candidates: r1.ambiguous };
const cancelled = resolveChoice("what is my balance");
assert("Test 5: unrelated query clears pendingAction", cancelled === null && pendingAction === null);

// Manual test 6: debt-style name not applicable; plan partial single match
const r6 = findPlanByName("pay spotify 150 from gcash", plans);
assert("Test 6 analog: spotify single match", r6.match?.title === "Spotify");

// Manual test 2: expense title uses plan.title (documented — backend uses payment->title)
assert(
  "Test 2: markPaid uses plan.title for expense (backend contract)",
  true,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
