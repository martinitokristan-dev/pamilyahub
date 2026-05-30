import {
  detectIntent,
  isFinanceRelated,
  normalizeText,
  getIntentType,
} from "@/lib/chatIntents.js";
import {
  extractAmount,
  detectCategory,
  extractExpenseReason,
  matchWallet,
  extractPersonName,
  extractWalletNameForCreate,
  extractWalletTypeFromText,
  canonicalWalletNameFromType,
  inferWalletType,
  WALLET_DEFINITIONS,
  getCategoryLabel,
  extractTransferWallets,
  CATEGORY_MAP, // FIXED: category keyword map for query filtering
  CATEGORY_LABELS, // FIXED: category labels for query replies
} from "@/lib/chatEntities.js";

import { useExpensesStore } from "@/stores/expenses.js";
import { useWalletsStore } from "@/stores/wallets.js";
import { useDebtsStore } from "@/stores/debts.js";
import { useSalaryStore } from "@/stores/salary.js";
import { useDashboardStore } from "@/stores/dashboard.js";
import {
  detectSmallTalk,
  getFlowKnowledgeMatch,
  getSmallTalkReply,
  isTechnicalQuestion,
  matchSemanticPattern,
  getLastBotAction,
  setLastBotAction,
  clearLastBotAction,
  matchContextualInference,
  getCommandStartPrefix,
} from "@/lib/chatKnowledge.js";

import { advancedClassify } from "@/lib/chatNlu.js";
import { generateSmartFallback } from "@/lib/chatSmartFallback.js";
import api from "@/lib/axios.js";

// FIXED: replaced single global with TTL-aware session Map
// to prevent race conditions and stale context execution
const _pendingContexts = new Map();
const PENDING_CONTEXT_TTL = 2 * 60 * 1000;
const _lastPickedIndex = new Map();
const _chatBudgetByMonth = new Map();
const _chatBudgetUndoByMonth = new Map();
const CHAT_BUDGET_STORAGE_KEY = "elefam_chat_budget_by_month";
const _sessionLastAction = new Map();

function rememberSessionAction(sessionId = "default", intent = "", entities = {}) {
  _sessionLastAction.set(sessionId, {
    intent,
    entities: { ...entities },
    at: Date.now(),
  });
}

function getSessionLastAction(sessionId = "default") {
  return _sessionLastAction.get(sessionId) || null;
}

function resolveWalletLikeEntity(walletCandidate, wallets = []) {
  if (!walletCandidate) return null;
  if (walletCandidate.id) {
    return wallets.find((w) => String(w.id) === String(walletCandidate.id)) || walletCandidate;
  }
  if (walletCandidate.name) {
    const byName = wallets.find(
      (w) => String(w.name || "").toLowerCase() === String(walletCandidate.name || "").toLowerCase(),
    );
    if (byName) return byName;
  }
  return null;
}

function pickAlternativeWallet(wallets = [], ...excludeCandidates) {
  const excludedIds = new Set(
    excludeCandidates
      .map((c) => resolveWalletLikeEntity(c, wallets))
      .filter(Boolean)
      .map((w) => String(w.id)),
  );

  if (!excludedIds.size) return wallets[0] || null;
  return wallets.find((w) => !excludedIds.has(String(w.id))) || null;
}const ACTION_TRIGGER_WORDS = {
  log_expense: [
    "spend", "spent", "buy", "bought", "cost", "log", "bili", "bumili", "gastos", "nagastos", "expense"
  ],
  deposit: [
    "deposit", "add", "dagdag", "lagay", "nagdeposito", "ipasok"
  ],
  transfer: [
    "transfer", "move", "send", "pass", "lipat", "ipasa", "pasa", "padala"
  ],
  create_debt: [
    "owe", "owes", "utang", "hiram", "debt", "lending", "lent"
  ],
  pay_debt: [
    "pay", "paid", "bayad", "nagbayad", "singil", "siningil"
  ],
  set_budget: [
    "budget", "limit"
  ],
  create_wallet: [
    "wallet", "create", "gawa"
  ],
};

function hasExplicitActionTrigger(text, intent) {
  if (!text || !intent) return false;
  const normalized = normalizeText(text);
  const baseIntent = intent.startsWith("create_debt") ? "create_debt" : intent;
  const triggers = ACTION_TRIGGER_WORDS[baseIntent];
  if (!triggers) return false;
  return triggers.some((word) => {
    const regex = new RegExp(`\\b${word}`, "i");
    return regex.test(normalized);
  });
}

function inferFollowupEntitiesFromContext(
  text,
  pendingCtx,
  sessionId,
  missingBefore = [],
  wallets = [],
) {
  const normalized = normalizeText(text);
  const prior = getSessionLastAction(sessionId);
  const priorEntities = prior?.entities || {};
  const inferred = {};
  if (!priorEntities || !Object.keys(priorEntities).length) return inferred;

  const missingSet = new Set(missingBefore);
  const hasContextRef =
    /\b(same|again|that one|that|this|it|there|as before|previous|earlier|before|prior|other|another|else)\b/.test(
      normalized,
    );

  if (!hasContextRef) return inferred;

  if (
    missingSet.has("amount") &&
    /\b(same amount|same|again|that amount|as before|previous amount|prior amount|use previous amount|use that amount|that amount|it)\b/.test(
      normalized,
    )
  ) {
    if (priorEntities.amount && Number(priorEntities.amount) > 0) {
      inferred.amount = Number(priorEntities.amount);
    }
  }

  if (pendingCtx.intent === "deposit" || pendingCtx.intent === "log_expense") {
    if (
      missingSet.has("wallet") &&
      /\b(wallet|account|same|again|that one|same one|there|that wallet|that account|it|other wallet|another wallet)\b/.test(
        normalized,
      )
    ) {
      const candidate =
        (/\b(other wallet|another wallet|other account|another account|else)\b/.test(normalized)
          ? pickAlternativeWallet(
              wallets,
              pendingCtx.entities.wallet,
              priorEntities.wallet,
              priorEntities.fromWallet,
              priorEntities.toWallet,
            )
          : null) ||
        resolveWalletLikeEntity(priorEntities.wallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.fromWallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.toWallet, wallets);
      if (candidate) inferred.wallet = candidate;
    }
  }

  if (pendingCtx.intent === "transfer") {
    if (
      missingSet.has("fromWallet") &&
      /\b(from|source|same|again|that one|there|from there|that wallet|it|other wallet|another wallet)\b/.test(
        normalized,
      )
    ) {
      const candidate =
        (/\b(other wallet|another wallet|other account|another account|else)\b/.test(normalized)
          ? pickAlternativeWallet(
              wallets,
              pendingCtx.entities.toWallet,
              priorEntities.fromWallet,
              priorEntities.toWallet,
              priorEntities.wallet,
            )
          : null) ||
        resolveWalletLikeEntity(priorEntities.fromWallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.wallet, wallets);
      if (candidate) inferred.fromWallet = candidate;
    }
    if (
      missingSet.has("toWallet") &&
      /\b(to|destination|target|same|again|that one|there|to there|that wallet|it|other wallet|another wallet)\b/.test(
        normalized,
      )
    ) {
      const candidate =
        (/\b(other wallet|another wallet|other account|another account|else)\b/.test(normalized)
          ? pickAlternativeWallet(
              wallets,
              pendingCtx.entities.fromWallet,
              priorEntities.toWallet,
              priorEntities.fromWallet,
              priorEntities.wallet,
            )
          : null) ||
        resolveWalletLikeEntity(priorEntities.toWallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.wallet, wallets);
      if (candidate) inferred.toWallet = candidate;
    }
  }

  if (pendingCtx.intent === "log_expense") {
    if (
      missingSet.has("category") &&
      /\b(same|again|same category|that category|same type|for that|for it|same reason|same as before)\b/.test(
        normalized,
      )
    ) {
      if (priorEntities.category) inferred.category = priorEntities.category;
      if (priorEntities.reason && !pendingCtx.entities.reason) {
        inferred.reason = priorEntities.reason;
      }
    }
  }

  if (pendingCtx.intent === "create_debt") {
    if (
      missingSet.has("person") &&
      /\b(same person|same|again|that one|that person|for him|for her|for them|that)\b/.test(
        normalized,
      )
    ) {
      if (priorEntities.person) inferred.person = priorEntities.person;
    }
    if (
      missingSet.has("walletId") &&
      /\b(same wallet|same account|same|again|that one|there|it|other wallet|another wallet)\b/.test(
        normalized,
      )
    ) {
      const candidate =
        (/\b(other wallet|another wallet|other account|another account|else)\b/.test(normalized)
          ? pickAlternativeWallet(
              wallets,
              pendingCtx.entities.walletId
                ? wallets.find((w) => String(w.id) === String(pendingCtx.entities.walletId))
                : null,
              priorEntities.wallet,
              priorEntities.fromWallet,
              priorEntities.toWallet,
            )
          : null) ||
        resolveWalletLikeEntity(priorEntities.wallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.fromWallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.toWallet, wallets);
      if (candidate?.id) inferred.walletId = candidate.id;
      else if (priorEntities.walletId) inferred.walletId = priorEntities.walletId;
    }
  }

  if (pendingCtx.intent === "pay_debt") {
    if (
      missingSet.has("debtId") &&
      /\b(same debt|same person|same|again|that one|that debt|for that debt|for it|that one)\b/.test(
        normalized,
      )
    ) {
      if (priorEntities.debtId) inferred.debtId = priorEntities.debtId;
    }
    if (
      missingSet.has("walletId") &&
      /\b(same wallet|same account|same|again|that one|there|it|other wallet|another wallet)\b/.test(
        normalized,
      )
    ) {
      const candidate =
        (/\b(other wallet|another wallet|other account|another account|else)\b/.test(normalized)
          ? pickAlternativeWallet(
              wallets,
              pendingCtx.entities.walletId
                ? wallets.find((w) => String(w.id) === String(pendingCtx.entities.walletId))
                : null,
              priorEntities.wallet,
              priorEntities.fromWallet,
              priorEntities.toWallet,
            )
          : null) ||
        resolveWalletLikeEntity(priorEntities.wallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.fromWallet, wallets) ||
        resolveWalletLikeEntity(priorEntities.toWallet, wallets);
      if (candidate?.id) inferred.walletId = candidate.id;
      else if (priorEntities.walletId) inferred.walletId = priorEntities.walletId;
    }
  }

  return inferred;
}

function getMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function loadChatBudgets() {
  if (typeof window === "undefined") return;
  if (_chatBudgetByMonth.size > 0) return;
  try {
    const raw = window.localStorage.getItem(CHAT_BUDGET_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([k, v]) => {
      const n = parseFloat(v);
      if (!Number.isNaN(n) && Number.isFinite(n) && n > 0) {
        _chatBudgetByMonth.set(k, n);
      }
    });
  } catch {
    // ignore storage parsing errors
  }
}

function persistChatBudgets() {
  if (typeof window === "undefined") return;
  try {
    const payload = Object.fromEntries(_chatBudgetByMonth.entries());
    window.localStorage.setItem(
      CHAT_BUDGET_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // ignore storage write errors
  }
}

function getMonthlyBudgetLimit(monthKey = getMonthKey()) {
  loadChatBudgets();
  const n = _chatBudgetByMonth.get(monthKey);
  if (n === null || n === undefined) return null;
  const parsed = parseFloat(n);
  return Number.isNaN(parsed) ? null : parsed;
}

function setMonthlyBudgetLimit(amount, monthKey = getMonthKey()) {
  loadChatBudgets();
  const normalized = parseFloat(Number(amount).toFixed(2));
  _chatBudgetByMonth.set(monthKey, normalized);
  persistChatBudgets();
  return normalized;
}

function deleteMonthlyBudgetLimit(monthKey = getMonthKey()) {
  loadChatBudgets();
  _chatBudgetByMonth.delete(monthKey);
  persistChatBudgets();
}

function setPendingContext(sessionId, ctx) {
  _pendingContexts.set(sessionId, {
    ...ctx,
    _setAt: Date.now(),
  });
}

function getPendingContext(sessionId) {
  const ctx = _pendingContexts.get(sessionId);
  if (!ctx) return null;
  if (Date.now() - ctx._setAt > PENDING_CONTEXT_TTL) {
    _pendingContexts.delete(sessionId);
    return null;
  }
  return ctx;
}

function deletePendingContext(sessionId) {
  _pendingContexts.delete(sessionId);
}

const REQUIRED_FIELDS = {
  deposit: ["amount", "wallet"],
  log_expense: ["amount", "wallet", "category"],
  transfer: ["amount", "fromWallet", "toWallet"],
  create_debt: ["amount", "person", "type"],
  pay_debt: ["debtId", "amount", "walletId"],
  set_budget: ["amount"],
};

// ================================================================
// DELIBERATIVE ACTION ORCHESTRATOR
// Centralizes UNDERSTAND → VALIDATE → PLAN → RESPOND for actions
// ================================================================

/**
 * Plan an action intent: validate required fields, decide next step,
 * and return appropriate response (ask follow-up or execute).
 *
 * @param {string} intent - Action intent name (e.g., "log_expense")
 * @param {object} entities - Extracted entities from NLU
 * @param {string} sessionId - Chat session ID
 * @param {string} rawText - Original user text (for context)
 * @returns {Promise<{ok: boolean, message: string, kind: string, intentType?: string}>}
 */
async function planAction(intent, entities, sessionId, rawText = "") {
  const walletsStore = useWalletsStore();
  const normalized = normalizeText(rawText);

  // ── STAGE 1: VALIDATE REQUIRED FIELDS ───────────────────────────────
  const required = REQUIRED_FIELDS[intent] || [];
  const missing = required.filter((field) => {
    const val = entities[field];
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    // Special case: category "expense" is not a real category
    if (intent === "log_expense" && field === "category" && val === "expense")
      return true;
    return false;
  });

  // ── STAGE 2: PLAN NEXT ACTION ────────────────────────────────────────
  if (missing.length > 0) {
    // Missing fields → ask follow-up
    const nextField = missing[0];

    // Check for ambiguous debt matches when debtId is missing in pay_debt
    let ambiguousDebts = undefined;
    if (intent === "pay_debt" && nextField === "debtId") {
      const debtsStore = useDebtsStore();
      if (debtsStore.debts.length === 0) await debtsStore.fetchAll();
      const debtsResult = findDebtByName(rawText, debtsStore.debts);
      if (debtsResult.ambiguous) {
        ambiguousDebts = debtsResult.ambiguous;
      }
    }

    const nextCtx = {
      intent,
      entities,
      ...(ambiguousDebts ? { ambiguousDebts } : {})
    };

    setPendingContext(sessionId, nextCtx);
    const question = askForMissingField(nextField, nextCtx);
    return {
      ok: false,
      message: question,
      kind: "question",
      intentType: "action",
    };
  }

  // ── STAGE 3: EXECUTE (all fields present) ────────────────────────────
  clearPendingContext(sessionId);
  return executeIntent(intent, entities, sessionId);
}

// ================================================================
// END ORCHESTRATOR
// ================================================================

// FIXED: dynamic reminder message for all pending intent types
function getPendingReminder(ctx) {
  if (!ctx) return "";
  const entities = ctx.entities || {};
  const intentName = (ctx.intent || "").startsWith("create_debt") ? "create_debt" : ctx.intent;

  if (intentName === "create_wallet") {
    return `I'm still waiting for the starting balance of your ${ctx.walletName} wallet. Reply with an amount whenever you're ready!`;
  }
  if (intentName === "confirm_interruption") {
    const prevDisp = getIntentDisplayName(ctx.previousCtx.intent);
    return `I'm still waiting for your response on whether you want to continue with your ${prevDisp}. Please reply with yes/continue or no/cancel.`;
  }
  if (intentName === "deposit") {
    if (!entities.wallet) {
      return `I'm still waiting for which wallet you want to deposit to. Just tell me the wallet name!`;
    }
    if (entities.amount === null || entities.amount === undefined) {
      return `I'm still waiting for how much you want to deposit to ${entities.wallet.name}.`;
    }
    return `I'm still processing your deposit to ${entities.wallet.name}.`;
  }
  if (intentName === "log_expense") {
    if (entities.amount === null || entities.amount === undefined) {
      return `I'm still waiting for the expense amount.`;
    }
    if (!entities.wallet) {
      return `I'm still waiting for which wallet to deduct this expense from.`;
    }
    if (!entities.category || entities.category === "expense") {
      return `I'm still waiting for what this expense was for.`;
    }
  }
  if (intentName === "create_debt") {
    const side = entities.type === "i_owe" ? "who you owe" : "who owes you";
    if (!entities.person) {
      return `I'm still waiting for ${side}.`;
    }
    if (entities.amount === null || entities.amount === undefined) {
      const verb =
        entities.type === "i_owe"
          ? `how much you owe ${entities.person}`
          : `how much ${entities.person} owes you`;
      return `I'm still waiting for ${verb}.`;
    }
    if (entities.type === "owed_to_me" && !entities.walletId) {
      return `I'm still waiting for which wallet you used to lend money to ${normalizeName(entities.person)}.`;
    }
  }
  if (intentName === "pay_debt") {
    if (!entities.debtId) {
      return `I'm still waiting for which debt you're paying.`;
    }
    if (!entities.amount) {
      return `I'm still waiting for how much you paid.`;
    }
    if (!entities.walletId) {
      const debtsStore = useDebtsStore();
      const debt = debtsStore.debts.find(d => String(d.id) === String(entities.debtId));
      if (debt && debt.type === "owed_to_me") {
        return `I'm still waiting for which wallet ${debt.name} paid you.`;
      }
      return `I'm still waiting for which wallet to use for this payment.`;
    }
  }
  if (intentName === "transfer") {
    if (!entities.fromWallet && !entities.toWallet)
      return `I'm still waiting for which wallets to transfer between.`;
    if (!entities.fromWallet)
      return `I'm still waiting for which wallet to transfer FROM.`;
    if (!entities.toWallet)
      return `I'm still waiting for which wallet to transfer TO.`;
    if (!entities.amount) return `I'm still waiting for how much to transfer.`;
  }
  if (intentName === "set_budget") {
    if (!entities.amount) {
      return `I'm still waiting for how much you want to set your budget to.`;
    }
  }
  return "";
}

// FIXED: now accepts sessionId so callers can clear the right session
export function clearPendingContext(sessionId = "default") {
  deletePendingContext(sessionId);
}

function askForMissingField(field, pendingCtx) {
  const intent = pendingCtx.intent;
  const walletsStore = useWalletsStore();
  const walletList = walletsStore.wallets.map((w) => w.name).join(", ");
  if (field === "amount") {
    if (intent === "deposit")
      return "How much are you depositing? Just type a number.";
    if (intent === "log_expense") return "How much did you spend?";
    if (intent === "transfer") return "How much do you want to transfer?";
    if (intent === "create_debt") return "How much is the debt amount?";
    if (intent === "pay_debt") {
      const debtsStore = useDebtsStore();
      const debt = debtsStore.debts.find(
        (d) => String(d.id) === String(pendingCtx.entities.debtId),
      );
      if (debt && debt.type === "owed_to_me") {
        return `How much did ${debt.name} pay you?`;
      }
      return "How much did you pay?";
    }
    if (intent === "set_budget") return "How much limit would you like to set? (e.g. 12000)";
    return "How much did you spend?";
  }
  if (field === "wallet") {
    const suffix = walletList ? `\n(${walletList})` : "";
    if (intent === "deposit") return `Which wallet are you depositing to?${suffix}`;
    if (intent === "log_expense") return `Which wallet did you use?${suffix}`;
    return `Which wallet?${suffix}`;
  }
  if (field === "category") {
    return "What was it for? (e.g. food, transpo)";
  }
  if (field === "fromWallet") {
    const suffix = walletList ? `\n(${walletList})` : "";
    return `Which wallet is the money coming FROM?${suffix}`;
  }
  if (field === "toWallet") {
    const suffix = walletList ? `\n(${walletList})` : "";
    return `Which wallet are you sending it TO?${suffix}`;
  }
  if (field === "person") {
    return "Who is this debt with?";
  }
  if (field === "type") {
    return "Is this money you owe, or money owed to you?";
  }
  if (field === "debtId") {
    if (pendingCtx.ambiguousDebts && pendingCtx.ambiguousDebts.length > 0) {
      const names = pendingCtx.ambiguousDebts.map((d) => d.name).join(" or ");
      const firstName = pendingCtx.ambiguousDebts[0].name.split(" ")[0];
      return `Which ${firstName} do you mean? ${names}?`;
    }
    return "Which debt are you paying? (Please provide the name or reference)";
  }
  if (field === "walletId") {
    if (intent === "pay_debt") {
      const debtsStore = useDebtsStore();
      const debt = debtsStore.debts.find((d) => String(d.id) === String(pendingCtx.entities.debtId));
      if (debt && debt.type === "owed_to_me") {
        return `Which wallet did ${debt.name} pay you?\n(${walletList})`;
      }
      return `Which wallet should this be deducted from?\n(${walletList})`;
    }
    if (intent === "create_debt") {
      return `Which wallet did you use to lend money to ${normalizeName(pendingCtx.entities.person)}?\n(${walletList})`;
    }
  }
  return `Please provide the ${field}.`;
}

async function executeIntent(intent, entities, sessionId) {
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();
  const debtsStore = useDebtsStore();
  const salaryStore = useSalaryStore();
  const expensesStore = useExpensesStore();

  if (intent === "deposit") {
    const result = await _executeDeposit(
      entities.amount,
      entities.wallet,
      salaryStore,
      dashboardStore,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "log_expense") {
    const payload = {
      amount: entities.amount,
      wallet: entities.wallet,
      categoryKey: entities.category,
      reason: entities.reason || "",
    };
    const result = await _executeLogExpense(payload, expensesStore, dashboardStore);
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "transfer") {
    const result = await _executeTransfer(
      entities.fromWallet,
      entities.toWallet,
      entities.amount,
      walletsStore,
      dashboardStore,
      sessionId,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "create_debt") {
    const result = await _executeCreateDebt(
      entities.person,
      entities.amount,
      entities.type,
      entities.walletId || null,
      debtsStore,
      dashboardStore,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "pay_debt") {
    const result = await _executePayDebt(
      entities.debtId,
      entities.amount,
      entities.walletId,
      debtsStore,
      walletsStore,
      dashboardStore,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "set_budget") {
    const result = await _executeSetBudget(entities.amount);
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  return { ok: false, message: `Unknown intent: ${intent}` };
}

export async function resolvePendingContext(
  text,
  pendingCtx,
  sessionId = "default",
) {
  const walletsStore = useWalletsStore();
  const normalized = normalizeText(text);

  const cancelWords = [
    "cancel",
    "nevermind",
    "never mind",
    "wag na",
    "ayaw na",
    "huwag na",
  ];
  if (cancelWords.some((w) => normalized.includes(w))) {
    clearPendingContext(sessionId);
    return {
      ok: false,
      message: `No worries! Action cancelled. Please let me know if you would like to try again.`,
      kind: "query",
    };
  }

  // Extract new entities from text
  const newEntities = {};

  let required = [...(REQUIRED_FIELDS[pendingCtx.intent] || [])];
  if (pendingCtx.intent === "create_debt" && pendingCtx.entities.type === "owed_to_me") {
    if (!required.includes("walletId")) {
      required.push("walletId");
    }
  }
  const missingBefore = required.filter((field) => !pendingCtx.entities[field]);

  const inferredFromContext = inferFollowupEntitiesFromContext(
    text,
    pendingCtx,
    sessionId,
    missingBefore,
    walletsStore.wallets,
  );
  Object.assign(newEntities, inferredFromContext);

  const extractedAmount = extractAmount(text);
  if (extractedAmount && extractedAmount > 0)
    newEntities.amount = extractedAmount;

  const matchedWallet = matchWallet(text, walletsStore.wallets);

  if (pendingCtx.intent === "deposit" || pendingCtx.intent === "log_expense") {
    if (matchedWallet) newEntities.wallet = matchedWallet;
  }

  if (pendingCtx.intent === "transfer") {
    // Fallback for single wallet answer during clarification
    if (
      missingBefore.length === 1 &&
      (missingBefore[0] === "fromWallet" || missingBefore[0] === "toWallet")
    ) {
      if (matchedWallet) {
        newEntities[missingBefore[0]] = matchedWallet;
      }
    } else {
      const { from: extractedFrom, to: extractedTo } = extractTransferWallets(
        text,
        walletsStore.wallets,
      );
      if (extractedFrom) newEntities.fromWallet = extractedFrom;
      if (extractedTo) newEntities.toWallet = extractedTo;
    }
  }

  if (pendingCtx.intent === "create_debt") {
    const extractedPerson = extractPersonName(text);
    if (extractedPerson) newEntities.person = extractedPerson;
    if (matchedWallet) newEntities.walletId = matchedWallet.id;
  }

  if (pendingCtx.intent === "pay_debt") {
    const debtsStore = useDebtsStore();
    if (debtsStore.debts.length === 0) {
      await debtsStore.fetchAll();
    }
    const debtsResult = findDebtByName(text, debtsStore.debts, pendingCtx.ambiguousDebts);
    if (debtsResult.match) {
      newEntities.debtId = debtsResult.match.id;
      delete pendingCtx.ambiguousDebts;
    } else if (debtsResult.ambiguous) {
      pendingCtx.ambiguousDebts = debtsResult.ambiguous;
    }

    // We should also allow the user to provide an amount when paying debt in the follow-up
    if (extractedAmount && extractedAmount > 0)
      newEntities.amount = extractedAmount;
    if (matchedWallet) newEntities.walletId = matchedWallet.id;
  }

  if (pendingCtx.intent === "log_expense") {
    const extractedCategory = detectCategory(text);
    const extractedReason = extractExpenseReason(text, walletsStore.wallets);
    const weakReasons = [
      "expense",
      "today",
      "yesterday",
      "now",
      "ngayon",
      "karon",
      "kanina",
      "on",
      "from",
      "sa",
      "via",
      "using",
      "wallet",
      "account",
    ];
    const reason = weakReasons.includes(
      String(extractedReason || "").toLowerCase(),
    )
      ? null
      : extractedReason;

    if (reason) {
      newEntities.reason = reason;
    }

    if (extractedCategory && extractedCategory !== "expense") {
      newEntities.category = extractedCategory;
    } else if (reason) {
      newEntities.category = "expense";
    } else if (
      normalized.includes("general") ||
      normalized.includes("none") ||
      normalized.includes("skip")
    ) {
      newEntities.category = "expense"; // Explicitly set to break the loop
    }
  }

  // Merge into existing entities
  pendingCtx.entities = { ...pendingCtx.entities, ...newEntities };

  // Check required fields
  const missing = required.filter((field) => {
    const val = pendingCtx.entities[field];
    if (!val) return true;
    if (
      pendingCtx.intent === "log_expense" &&
      field === "category" &&
      val === "expense" &&
      !pendingCtx.entities.reason
    )
      return true;
    return false;
  });

  if (missing.length > 0) {
    const nextField = missing[0];
    setPendingContext(sessionId, pendingCtx); // Save updated context

    return {
      ok: false,
      message: askForMissingField(nextField, pendingCtx),
      kind: "question",
    };
  }

  // All fields present! Execute!
  clearPendingContext(sessionId);
  return executeIntent(pendingCtx.intent, pendingCtx.entities, sessionId);
}

export const eleFamProfile = {
  name: "Marti",
  greeting:
    'Hi! I\'m Marti. I can help you with finance flows in this app like wallets, deposits, transfers, expenses, debts, and budget. Type "/help" to see detailed commands.',
  guardReply:
    'I can only help with finance flows in this app: add wallet, deposit, transfer, log expense, debt tracking, and budget checks. You can type "/help" for commands.',
};

const TECHNICAL_GUARD_REPLY =
  "I can't answer technical or developer questions. I only guide finance flows in this app like adding wallets, depositing, transferring, logging expenses, debt tracking, and budget.";

const FLOW_ONLY_FALLBACK =
  'I can help with finance flows only. Try asking: "how to add wallet", "how to deposit", "how to transfer", "how to log expense", "how to track debt", or "how to check budget".';

const HELP_MESSAGE = [
  "Here are some things you can say to me directly:",
  "",
  "Wallets & Balances",
  '• "See my wallets."',
  '• "How much is in my GCash?"',
  '• "New wallet Travel Fund 1000."',
  "",
  "Expenses",
  '• "Spent 500 on food from GCash."',
  '• "How much did I spend today?"',
  "",
  "Deposits",
  '• "Deposit 2000 to Maya."',
  "",
  "Debts & Payments",
  '• "I owe Ana 800."',
  '• "Mark owes me 400."',
  '• "Pay Ana 300 from GCash."',
  "",
  "Commands",
  '• "/help" - Show this list of suggestions',
  '• "/clear" - Clear the conversation history',
].join("\n");

const SYSTEM_WALLET_TYPES = WALLET_DEFINITIONS;

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// FIXED: detects if text is asking about a specific category
// Returns { key, label, keywords } or null if no category detected
function detectQueryCategory(text = "") {
  const normalized = normalizeText(text);
  for (const [key, keywords] of Object.entries(CATEGORY_MAP)) {
    const matched = keywords.find((kw) => normalized.includes(kw));
    if (matched) {
      return {
        key,
        label: CATEGORY_LABELS[key] || key,
        keywords,
      };
    }
  }
  return null;
}

// FIXED: two-tier category filter for expenses
// Tier 1: match e.category field (new expenses logged with category key)
// Tier 2: fallback to title keyword match (old expenses without category field)
function expenseMatchesCategory(expense, categoryKey, categoryKeywords) {
  // Tier 1: clean category field match
  if (
    expense.category &&
    String(expense.category).toLowerCase() === categoryKey
  ) {
    return true;
  }
  // Tier 2: title-based keyword fallback for legacy expenses
  const titleNormalized = String(expense.title || "").toLowerCase();
  return categoryKeywords.some((kw) => titleNormalized.includes(kw));
}

function pickRandom(lines = [], key = "") {
  if (!lines.length) return "";
  if (lines.length === 1) return lines[0];

  const trackKey = key || lines[0].slice(0, 20);
  const lastIndex = _lastPickedIndex.get(trackKey) ?? -1;

  let newIndex;
  let attempts = 0;
  do {
    newIndex = Math.floor(Math.random() * lines.length);
    attempts += 1;
  } while (newIndex === lastIndex && attempts < 10);

  _lastPickedIndex.set(trackKey, newIndex);
  return lines[newIndex]; // FIXED: reduce immediate response repetition
}

function normalizeName(value = "") {
  const v = String(value).trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

const FLOW_TOPIC_TRIGGER_TEXT = {
  add_wallet: "how to add wallet",
  deposit: "how to deposit",
  transfer: "how to transfer",
  log_expense: "how to log expense",
  debts: "how to pay debt",
  budget: "how to set budget",
  general_onboarding: "how to use this app",
};

function handleFlowHelp(text = "", entities = {}) {
  const topic = String(entities?.topic || "").trim();
  if (topic && FLOW_TOPIC_TRIGGER_TEXT[topic]) {
    const topicMatched = getFlowKnowledgeMatch(FLOW_TOPIC_TRIGGER_TEXT[topic]);
    if (topicMatched) {
      return {
        ok: true,
        message: topicMatched.answer,
        kind: "help",
      };
    }
  }

  const matched = getFlowKnowledgeMatch(text);
  if (matched) {
    return {
      ok: true,
      message: matched.answer,
      kind: "help",
    };
  }

  return {
    ok: true,
    message: [
      "I can guide these EleFam flows:",
      "• how to add wallet",
      "• how to deposit",
      "• how to transfer",
      "• how to log expense",
      "• how to track/pay debt",
      "• how to check/set budget",
    ].join("\n"),
    kind: "help",
  };
}

async function ensureLoaded() {
  const wallets = useWalletsStore();
  const expenses = useExpensesStore();
  const debts = useDebtsStore();
  const dashboard = useDashboardStore();

  // Use a Promise.all but with a short timeout or just don't block if we have cached data
  // For offline first, if we have local data, we can proceed.
  const loaders = [];
  if (!wallets.fetched) loaders.push(wallets.fetchAll().catch(() => { }));
  if (!expenses.fetched) loaders.push(expenses.fetchAll().catch(() => { }));
  if (!debts.fetched) loaders.push(debts.fetchAll().catch(() => { }));
  if (!dashboard.fetched) loaders.push(dashboard.fetchStats().catch(() => { }));

  if (loaders.length > 0) {
    // If we have NO data at all, we might need to wait a bit.
    // But if we've already hydrated from IndexedDB (indicated by length > 0 or stats exist),
    // we should NOT block the UI for network timeouts.
    const hasLocalData =
      wallets.wallets.length > 0 || expenses.expenses.length > 0;
    if (!hasLocalData) {
      await Promise.race([
        Promise.all(loaders),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } else {
      // Run in background, don't await
      Promise.all(loaders);
    }
  }
}

function findDebtByName(inputText, debts = [], candidates = null) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) return { match: null };

  // Use candidates if provided (e.g. during ambiguity resolution), otherwise open debts
  const searchPool = candidates && candidates.length > 0
    ? candidates
    : debts.filter((d) => !(d.is_paid || String(d.status || "").toLowerCase() === "paid"));

  if (searchPool.length === 0) return { match: null };

  // 1. Exact match or full name containment check (highest priority)
  // E.g. "pay jane smith" contains "jane smith"
  const fullMatches = searchPool.filter((d) => {
    const name = normalizeText(d.name);
    return name && normalizedInput.includes(name);
  });
  if (fullMatches.length === 1) return { match: fullMatches[0] };
  if (fullMatches.length > 1) return { ambiguous: fullMatches };

  // 2. Partial name match (first name or last name check)
  const excludeWords = new Set([
    "pay", "paid", "bayad", "nagbayad", "singil", "siningil",
    "debt", "utang", "hiram", "owe", "owes", "lent", "lend",
    "on", "in", "at", "for", "with", "from", "to", "the", "a",
    "i", "me", "my", "hello", "hi", "please", "can", "you",
    "cash", "wallet", "gcash", "maya", "bpi", "bdo", "coins"
  ]);

  const inputWords = normalizedInput
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ""))
    .filter(w => w && !excludeWords.has(w));

  const partialMatches = searchPool.filter((d) => {
    const name = normalizeText(d.name);
    if (!name) return false;
    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    return inputWords.some(word => word === firstName || (nameParts.length > 1 && word === lastName));
  });

  if (partialMatches.length === 1) return { match: partialMatches[0] };
  if (partialMatches.length > 1) return { ambiguous: partialMatches };

  // 3. Ordinal matches (e.g. "first one", "second", "1st") if a candidate list is active
  if (candidates && candidates.length > 0) {
    const ordinalWords = ["first", "1st", "one", "unang", "uno", "second", "2nd", "pangalawang", "dos"];
    const matchedOrdinal = inputWords.find(w => ordinalWords.includes(w));
    if (matchedOrdinal) {
      const isFirst = ["first", "1st", "one", "unang", "uno"].includes(matchedOrdinal);
      const index = isFirst ? 0 : 1;
      if (searchPool[index]) {
        return { match: searchPool[index] };
      }
    }
  }

  return { match: null };
}

function financeTipFromStats(stats = {}) {
  const expensesStore = useExpensesStore();
  const walletsStore = useWalletsStore();

  const expenses = parseFloat(stats.monthly_expenses || 0);
  const left = parseFloat(stats.remaining_salary || 0);
  const debt = parseFloat(stats.debts_i_owe || 0);

  // 1. Check for critical budget state
  if (left <= 0) {
    return pickRandom(
      [
        "Tip: Your budget is on life support. Non-essential spending is strictly cancelled until further notice.",
        "Tip: Budget went negative. Time to enter monk mode — no gala, no extras, just survival.",
      ],
      "tips_critical_budget",
    );
  }

  // 2. Check for Wallet Dominance (Personalized Activity)
  const recentExpenses = expensesStore.expenses.slice(0, 50);
  if (recentExpenses.length >= 5) {
    const walletCounts = {};
    recentExpenses.forEach((e) => {
      walletCounts[e.wallet_id] = (walletCounts[e.wallet_id] || 0) + 1;
    });

    const mostUsedWalletId = Object.keys(walletCounts).reduce((a, b) =>
      walletCounts[a] > walletCounts[b] ? a : b,
    );
    const dominance = walletCounts[mostUsedWalletId] / recentExpenses.length;

    if (dominance > 0.7) {
      const wallet = walletsStore.wallets.find(
        (w) => String(w.id) === String(mostUsedWalletId),
      );
      if (wallet) {
        return `Tip: You've been using your ${wallet.name} for ${Math.round(dominance * 100)}% of your recent activity. Consider using other wallets to balance your funds!`;
      }
    }
  }

  // 3. High Spending vs Salary
  if (expenses > 0 && left > 0 && expenses > left * 2) {
    return pickRandom(
      [
        "Tip: Your spending is sprinting while your budget is crawling. Review your transactions before it gets dramatic.",
        "Tip: Expenses are doing parkour over your remaining budget. Time to pause and plan, not panic-buy.",
      ],
      "tips_high_spending",
    );
  }

  // 4. Debt awareness
  if (debt > 0) {
    return pickRandom(
      [
        "Tip: Debt is still in your DMs. Pay the high-priority ones first before they start calling.",
        "Tip: You have active payables. Small bites now prevent a big budget stomachache later.",
      ],
      "tips_debt",
    );
  }

  // 5. Default encouraging tips
  return pickRandom(
    [
      "Tip: You are doing well. Keep logging daily — consistency beats perfection.",
      "Tip: Finances looking calm. Let's keep it that way by tracking every sneaky small expense.",
    ],
    "tips_default",
  );
}

async function handleLogExpense(text, sessionId = "default") {
  const walletsStore = useWalletsStore();
  const amount = extractAmount(text);
  const wallet = matchWallet(text, walletsStore.wallets);
  const categoryKey = detectCategory(text);
  const extractedReason = extractExpenseReason(text, walletsStore.wallets);
  const weakReasons = [
    "expense",
    "today",
    "yesterday",
    "now",
    "ngayon",
    "karon",
    "kanina",
    "on",
    "from",
    "sa",
    "via",
    "using",
    "wallet",
    "account",
  ];
  const reason = weakReasons.includes(
    String(extractedReason || "").toLowerCase(),
  )
    ? null
    : extractedReason;
  const hasCategory = categoryKey && categoryKey !== "expense";
  return planAction(
    "log_expense",
    { amount, wallet, category: hasCategory ? categoryKey : "expense", reason },
    sessionId,
    text,
  );
}

// FIXED: private log_expense executor used by handler and resolver
async function _executeLogExpense(payload, expensesStore, dashboardStore) {
  if (Number(payload.wallet.balance) < payload.amount) {
    return {
      ok: false,
      message: `Not enough balance in ${payload.wallet.name || payload.wallet.type} to spend ${formatMoney(payload.amount)}. You only have ${formatMoney(payload.wallet.balance)} left.`,
      kind: "query",
    };
  }

  const categoryLabel = getCategoryLabel(payload.categoryKey);
  const title = payload.reason || categoryLabel || "Expense via EleFam";

  await expensesStore.create({
    title,
    amount: payload.amount,
    category: payload.categoryKey || "expense",
    description: "Logged via EleFam",
    date: new Date().toISOString().slice(0, 10),
    wallet_id: payload.wallet.id,
  });
  dashboardStore.fetchStats().catch(() => { });

  const wittyDone = [
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
  ];
  setLastBotAction("log_expense");
  const titleLower = title.toLowerCase();
  const isLending = titleLower.includes("lent") || titleLower.includes("lend");
  return {
    ok: true,
    message: pickRandom(wittyDone, "log_expense"),
    kind: "action",
    walletType: isLending ? "lending" : payload.wallet.type,
  };
}

function handleMissingWalletsQuery(text = "") {
  const walletsStore = useWalletsStore();
  const normalized = normalizeText(text);
  const existingTypes = new Set(
    walletsStore.wallets.map((w) => String(w.type || "").toLowerCase()),
  );

  // If asking for "available" or "total", list EVERYTHING with status
  if (normalized.includes("available") || normalized.includes("total")) {
    const list = SYSTEM_WALLET_TYPES.map((w) => {
      const hasIt = existingTypes.has(w.type);
      return `• ${w.label} ${hasIt ? "(You already have)" : "(Not added)"}`;
    }).join("\n");

    return {
      ok: true,
      message: `AVAILABLE WALLETS IN ELEFAM:\n\n${list}`,
      kind: "query",
    };
  }

  const missing = SYSTEM_WALLET_TYPES.filter(
    (w) => !existingTypes.has(w.type),
  ).map((w) => w.label);

  if (!missing.length) {
    return {
      ok: true,
      message: "You already have all wallet types available in the system!",
      kind: "query",
    };
  }

  const wittyDone = [
    `Wallet types you do not have yet: ${missing.join(", ")}. Time to get them all!`,
    `Missing wallet types: ${missing.join(", ")}. Complete your collection!`,
    `You're missing these wallet types: ${missing.join(", ")}. Let's get them set up!`,
  ];
  return {
    ok: true,
    message: pickRandom(wittyDone, "query_missing_wallets"),
    kind: "query",
  };
}

// FIXED: multi-turn deposit — now delegates to deliberative orchestrator
async function handleDeposit(text, sessionId = "default") {
  const walletsStore = useWalletsStore();
  const amount = extractAmount(text);
  const wallet = matchWallet(text, walletsStore.wallets);
  return planAction("deposit", { amount, wallet }, sessionId, text);
}

// FIXED: private deposit executor used by both handleDeposit and resolveDeposit
async function _executeDeposit(amount, wallet, salaryStore, dashboardStore) {
  await salaryStore.deposit({
    total_amount: amount,
    already_spent: 0,
    notes: "Deposit via EleFam",
    allocations: [{ wallet_id: wallet.id, amount }],
  });
  dashboardStore.fetchStats({}, true).catch(() => { });

  const wittyDone = [
    `Successfully deposited ${formatMoney(amount)} to ${wallet.name}.`,
  ];
  setLastBotAction("deposit");
  return {
    ok: true,
    message: pickRandom(wittyDone, "deposit"),
    kind: "action",
    walletType: wallet.type,
  };
}

// FIXED: multi-turn debt creation — now delegates to deliberative orchestrator
async function handleCreateDebt(text, type, sessionId = "default") {
  const walletsStore = useWalletsStore();
  const amount = extractAmount(text);
  const name = extractPersonName(text);
  const wallet = matchWallet(text, walletsStore.wallets);
  return planAction(
    "create_debt",
    { amount, person: name, type, walletId: wallet?.id },
    sessionId,
    text,
  );
}

// FIXED: private debt executor used by both handleCreateDebt and resolveCreateDebt
async function _executeCreateDebt(
  name,
  amount,
  type,
  walletId,
  debtsStore,
  dashboardStore,
) {
  await debtsStore.create({
    name,
    amount,
    type,
    description: "Logged via EleFam",
    due_date: "",
    wallet_id: walletId,
  });

  dashboardStore.fetchStats().catch(() => { });

  const wittyDone = [
    `Successfully logged debt of ${formatMoney(amount)} ${type === "i_owe" ? "owed to" : "owed by"} ${name}.`,
  ];
  setLastBotAction("create_debt");
  return {
    ok: true,
    message: pickRandom(wittyDone, `create_debt_${type}`),
    kind: "action",
    walletType: type === "owed_to_me" ? "lending" : null,
  };
}

async function handlePayDebt(text, sessionId = "default") {
  const debtsStore = useDebtsStore();
  if (debtsStore.debts.length === 0) {
    await debtsStore.fetchAll();
  }
  const walletsStore = useWalletsStore();
  const debtsResult = findDebtByName(text, debtsStore.debts);
  const amount = extractAmount(text);
  const wallet = matchWallet(text, walletsStore.wallets);
  const walletId = wallet?.id ?? null;
  return planAction(
    "pay_debt",
    { debtId: debtsResult.match?.id || null, amount, walletId },
    sessionId,
    text,
  );
}

async function _executePayDebt(
  debtId,
  amount,
  walletId,
  debtsStore,
  walletsStore,
  dashboardStore,
) {
  const debt = debtsStore.debts.find((d) => String(d.id) === String(debtId));
  if (!debt) {
    return { ok: false, message: "Debt not found.", kind: "query" };
  }

  const debtAmount = Math.abs(parseFloat(debt.amount || 0));

  const payAmount =
    amount && amount > 0 && amount < debtAmount ? amount : debtAmount;
  const payWallet = walletId
    ? walletsStore.wallets.find((w) => String(w.id) === String(walletId))
    : null;
  if (
    debt.type === "i_owe" &&
    payWallet &&
    Number(payWallet.balance) < payAmount
  ) {
    return {
      ok: false,
      message: `Not enough balance in ${payWallet.name || payWallet.type} to pay ${formatMoney(payAmount)}. You only have ${formatMoney(payWallet.balance)} left.`,
      kind: "query",
    };
  }

  if (amount && amount > 0 && amount < debtAmount) {
    await debtsStore.partialPay(debt.id, amount, walletId);
    dashboardStore.fetchStats().catch(() => { });
    const wittyDone = [
      `Successfully paid ${formatMoney(amount)} for ${debt.name}.`,
    ];
    return {
      ok: true,
      message: pickRandom(wittyDone, "pay_debt_partial"),
      kind: "action",
    };
  }

  await debtsStore.markPaid(debt.id, walletId);
  dashboardStore.fetchStats().catch(() => { });
  const wittyDone = [`Successfully settled debt for ${debt.name}.`];
  return {
    ok: true,
    message: pickRandom(wittyDone, "pay_debt_full"),
    kind: "action",
  };
}

async function resolveCreateWallet(text, ctx, sessionId = "default") {
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();
  const normalized = normalizeText(text);

  if (
    normalized.includes("cancel") ||
    normalized.includes("nevermind") ||
    normalized.includes("never mind") ||
    normalized.includes("wag na") ||
    normalized.includes("ayaw na") ||
    normalized.includes("huwag na")
  ) {
    return {
      ok: false,
      message: `No worries! Wallet creation for ${ctx.walletName} has been cancelled. Let me know if you change your mind.`,
      kind: "query",
    };
  }

  let amount = extractAmount(text);
  if (amount === null) {
    const zeroWords = [
      "none",
      "empty",
      "wala",
      "zero",
      "nothing",
      "blank",
      "walang laman",
    ];
    if (normalized === "0" || zeroWords.some((w) => normalized.includes(w))) {
      amount = 0;
    } else {
      // FIXED: re-set with fresh TTL since user is still in the flow
      setPendingContext(sessionId, ctx);
      return {
        ok: false,
        message: `Hmm, I didn't quite catch the amount. How much is the starting balance for your ${ctx.walletName}? Just type a number like "500" or "0" if it's empty right now.`,
        kind: "question",
      };
    }
  }

  const { walletName, walletType } = ctx;
  const existing = walletsStore.wallets.find(
    (w) => String(w.name || "").toLowerCase() === walletName.toLowerCase(),
  );
  if (existing) {
    return {
      ok: false,
      message: `Looks like you already have a ${walletName} wallet. No duplicates allowed!`,
      kind: "query",
    };
  }

  await walletsStore.create({
    name: walletName,
    type: walletType,
    balance: amount,
    color: "",
    icon_url: "",
  });
  dashboardStore.fetchStats().catch(() => { });

  const wittyDone = [
    `${walletName} wallet has been successfully created with an initial balance of ${formatMoney(amount)}.`,
  ];
  setLastBotAction("create_wallet");
  return {
    ok: true,
    message: pickRandom(wittyDone, "create_wallet_followup"),
    kind: "action",
    walletType,
  };
}

async function handleCreateWallet(text, sessionId = "default", entities = {}) {
  const walletsStore = useWalletsStore();
  const detectedType = entities.walletType || extractWalletTypeFromText(text);
  const walletNameRaw = entities.walletName || extractWalletNameForCreate(text);
  const canonicalName = canonicalWalletNameFromType(detectedType);

  if (!walletNameRaw && !canonicalName) {
    return {
      ok: false,
      message:
        'Please include a wallet name. Example: "new wallet Travel Fund" or "new wallet GCash".',
    };
  }

  const walletName = canonicalName || normalizeName(walletNameRaw);
  const existing = walletsStore.wallets.find(
    (w) => String(w.name || "").toLowerCase() === walletName.toLowerCase(),
  );
  if (existing) {
    return {
      ok: false,
      message: `You already have a ${walletName} wallet. No duplicates allowed.`,
    };
  }

  const walletType = detectedType || inferWalletType(walletName);
  const rawAmount = entities.balance !== undefined ? entities.balance : extractAmount(text);

  if (rawAmount === null) {
    // FIXED: session-scoped pending context with TTL
    setPendingContext(sessionId, {
      intent: "create_wallet",
      walletName,
      walletType,
    });
    return {
      ok: true,
      message: `Understood. What's the starting balance for your ${walletName} wallet? Reply with an amount, or say "0" if it's empty right now.`,
      kind: "question",
    };
  }

  const dashboardStore = useDashboardStore();
  await walletsStore.create({
    name: walletName,
    type: walletType,
    balance: rawAmount,
    color: "",
    icon_url: "",
  });
  dashboardStore.fetchStats().catch(() => { });

  const wittyDone = [
    `${walletName} wallet has been successfully created with an initial balance of ${formatMoney(rawAmount)}.`,
  ];
  return {
    ok: true,
    message: pickRandom(wittyDone, "create_wallet_direct"),
    kind: "action",
    walletType,
  };
}

function handleQueryBalance(text) {
  const walletsStore = useWalletsStore();
  const normalized = normalizeText(text);
  const wallet = matchWallet(text, walletsStore.wallets);

  if (wallet) {
    const witty = [
      `Your ${wallet.name} balance is ${formatMoney(wallet.balance)}.`,
    ];
    return {
      ok: true,
      message: pickRandom(witty, "query_balance_wallet"),
      kind: "query",
      walletType: wallet.type,
    };
  }

  // Specific wallet mentioned but user doesn't have it yet
  const mentionedType = extractWalletTypeFromText(text);
  if (mentionedType) {
    const label = canonicalWalletNameFromType(mentionedType) || mentionedType;
    return {
      ok: false,
      message: `You don't have a ${label} wallet yet. Say "new wallet ${label}" to add one.`,
      kind: "query",
    };
  }

  const count = walletsStore.wallets.length;
  const total = walletsStore.wallets.reduce(
    (sum, w) => sum + parseFloat(w.balance || 0),
    0,
  );

  // Check count first before list to avoid "how many wallets" being swallowed by the list branch
  if (
    normalized.includes("how many") ||
    normalized.includes("ilang") ||
    normalized.includes("pila ka")
  ) {
    return {
      ok: true,
      message: `You currently have ${count} wallet${count === 1 ? "" : "s"} registered in EleFam with a combined total of ${formatMoney(total)}.`,
      kind: "query",
    };
  }

  // Check if asking for a list — match both singular "wallet" and plural "wallets"
  const isListQuery =
    normalized.includes("list") ||
    normalized.includes("show wallet") ||
    normalized.includes("show wallets") ||
    /\b(my )?wallets?\b/.test(normalized) ||
    normalized.includes("ano mga wallet ko") ||
    normalized.includes("unsa akong mga wallet");

  if (isListQuery) {
    const list = walletsStore.wallets
      .map((w) => `• ${w.name} (${formatMoney(w.balance)})`)
      .join("\n");
    return {
      ok: true,
      message: `YOUR WALLETS:\n\n${list}\n\nCombined total: ${formatMoney(total)}`,
      kind: "query",
    };
  }

  const witty = [
    `Your combined total balance across all ${count} wallets is ${formatMoney(total)}.`,
  ];
  return {
    ok: true,
    message: pickRandom(witty, "query_balance_total"),
    kind: "query",
  };
}

async function handleQueryExpenses(text = "") {
  const expensesStore = useExpensesStore();
  const walletsStore = useWalletsStore();
  const normalized = normalizeText(text);
  const asksLatest =
    /\b(latest|recent)\b.*\b(expense|expenses|spending)\b/.test(normalized) ||
    /\bshow\b.*\b(latest|recent)\b.*\bexpenses?\b/.test(normalized);
  const asksOverspending =
    /\bover\s*spend(ing)?\b/.test(normalized) ||
    /\btop\s+spending\s+categories\b/.test(normalized) ||
    /\bcategories\b.*\bspending\b/.test(normalized);
  const asksMonthCompare =
    /\bcompare\b.*\b(this\s+month|last\s+month)\b/.test(normalized) ||
    /\bthis\s+month\b.*\bvs\b.*\blast\s+month\b/.test(normalized) ||
    /\blast\s+month\b.*\bvs\b.*\bthis\s+month\b/.test(normalized) ||
    /\bmonth\s+over\s+month\b/.test(normalized);

  // ── 1. Detect wallet filter (existing logic) ──────────────────────────
  const wallet = matchWallet(text, walletsStore.wallets);

  // ── 2. Detect date range (existing logic) ─────────────────────────────
  let range = "month";
  if (
    normalized.includes("today") ||
    normalized.includes("ngayon") ||
    normalized.includes("this day") ||
    normalized.includes("ngayong araw")
  ) {
    range = "today";
  } else if (
    normalized.includes("yesterday") ||
    normalized.includes("kahapon")
  ) {
    range = "yesterday";
  } else if (
    normalized.includes("this week") ||
    normalized.includes("ngayong linggo")
  ) {
    range = "week";
  }

  // ── 3. Detect category filter (NEW) ───────────────────────────────────
  const queryCategory = detectQueryCategory(text);

  // ── 4. Ensure expenses loaded ─────────────────────────────────────────
  if (!expensesStore.fetched) await expensesStore.fetchAll();

  const parseExpenseDate = (expense) => {
    const raw = expense?.date || expense?.created_at || "";
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (asksMonthCompare) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;

    for (const expense of expensesStore.expenses) {
      const d = parseExpenseDate(expense);
      if (!d) continue;
      if (d >= thisMonthStart) {
        thisMonthTotal += parseFloat(expense.amount || 0);
      } else if (d >= lastMonthStart && d < thisMonthStart) {
        lastMonthTotal += parseFloat(expense.amount || 0);
      }
    }

    const diff = thisMonthTotal - lastMonthTotal;
    const trend =
      diff > 0
        ? `up by ${formatMoney(diff)}`
        : diff < 0
          ? `down by ${formatMoney(Math.abs(diff))}`
          : "unchanged";

    return {
      ok: true,
      message: `Spending comparison:\n• This month: ${formatMoney(thisMonthTotal)}\n• Last month: ${formatMoney(lastMonthTotal)}\n• Trend: ${trend}.`,
      kind: "query",
    };
  }

  // ── 5. Apply date range filter (existing logic) ───────────────────────
  let filtered = expensesStore.expenses;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (range === "today") {
    filtered = filtered.filter((e) => {
      const d = (e.date || e.created_at || "").slice(0, 10);
      return d === todayStr;
    });
  } else if (range === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    filtered = filtered.filter((e) => {
      const d = (e.date || e.created_at || "").slice(0, 10);
      return d === yesterdayStr;
    });
  } else if (range === "week") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    filtered = filtered.filter(
      (e) => new Date(e.date || e.created_at) >= sevenDaysAgo,
    );
  } else {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = filtered.filter(
      (e) => new Date(e.date || e.created_at) >= startOfMonth,
    );
  }

  // ── 6. Apply wallet filter (existing logic) ───────────────────────────
  if (wallet) {
    filtered = filtered.filter((e) => e.wallet_id === wallet.id);
  }

  // ── 7. Apply category filter (NEW) ────────────────────────────────────
  if (queryCategory) {
    filtered = filtered.filter((e) =>
      expenseMatchesCategory(e, queryCategory.key, queryCategory.keywords),
    );
  }

  const rangeLabel =
    range === "today"
      ? "today"
      : range === "yesterday"
        ? "yesterday"
        : range === "week"
          ? "this week"
          : "this month";
  const walletLabel = wallet ? ` via ${wallet.name}` : "";

  if (asksLatest) {
    const latestItems = [...filtered]
      .map((expense) => ({ ...expense, _parsedDate: parseExpenseDate(expense) }))
      .sort((a, b) => (b._parsedDate?.getTime() || 0) - (a._parsedDate?.getTime() || 0))
      .slice(0, 5);

    if (latestItems.length === 0) {
      return {
        ok: true,
        message: `I couldn't find recent expenses yet. Try logging one first, then ask me again for latest expenses.`,
        kind: "query",
        walletType: wallet?.type || null,
      };
    }

    const lines = latestItems
      .map((expense) => {
        const dateText = expense._parsedDate
          ? expense._parsedDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" })
          : "date unknown";
        return `• ${dateText} — ${expense.title || getCategoryLabel(expense.category) || "Expense"}: ${formatMoney(expense.amount)}`;
      })
      .join("\n");

    return {
      ok: true,
      message: `Here are your latest expenses:\n${lines}`,
      kind: "query",
      walletType: wallet?.type || null,
    };
  }

  if (asksOverspending) {
    const totalsByCategory = new Map();
    for (const expense of filtered) {
      const categoryKey = String(expense.category || "expense").toLowerCase();
      totalsByCategory.set(
        categoryKey,
        (totalsByCategory.get(categoryKey) || 0) + parseFloat(expense.amount || 0),
      );
    }

    const ranked = [...totalsByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (ranked.length === 0) {
      return {
        ok: true,
        message: `I couldn't find enough expense data this month to rank overspending categories yet.`,
        kind: "query",
        walletType: wallet?.type || null,
      };
    }

    const lines = ranked
      .map(([key, amount], index) => `${index + 1}. ${CATEGORY_LABELS[key] || getCategoryLabel(key) || key}: ${formatMoney(amount)}`)
      .join("\n");

    return {
      ok: true,
      message: `Top spending categories ${range === "month" ? "this month" : rangeLabel}:\n${lines}`,
      kind: "query",
      walletType: wallet?.type || null,
    };
  }

  // ── 8. Compute total ──────────────────────────────────────────────────
  const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  // ── 9. Build human-readable labels ────────────────────────────────────

  // ── 10. Build response ────────────────────────────────────────────────
  // Case A: Category-specific query with zero results
  if (queryCategory && filtered.length === 0) {
    return {
      ok: true,
      message: `No ${queryCategory.label} expenses found ${rangeLabel}${walletLabel}. Either you haven't logged any yet, or you've been really good about it!`,
      kind: "query",
      walletType: wallet?.type || null,
    };
  }

  // Case B: Category-specific query with results — show total + top items
  if (queryCategory) {
    // Show top 3 individual expenses in this category for context
    const topItems = [...filtered]
      .sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0))
      .slice(0, 3);

    const itemLines = topItems
      .map(
        (e) =>
          `  • ${e.title || queryCategory.label}: ${formatMoney(e.amount)}`,
      )
      .join("\n");

    const countLabel =
      filtered.length === 1
        ? "1 transaction"
        : `${filtered.length} transactions`;

    const witty = [
      `Your ${queryCategory.label} expenses ${rangeLabel}${walletLabel} total ${formatMoney(total)} across ${countLabel}.\n\nBreakdown:\n${itemLines}`,
    ];
    return {
      ok: true,
      message: pickRandom(witty, `query_expenses_${queryCategory.key}`),
      kind: "query",
      walletType: wallet?.type || null,
    };
  }

  // Case C: No category — general total query (existing behavior preserved)
  const witty = [
    `Your total expenses ${rangeLabel}${walletLabel} amount to ${formatMoney(total)}.`,
  ];
  return {
    ok: true,
    message: pickRandom(witty, "query_expenses"),
    kind: "query",
    walletType: wallet?.type || null,
  };
}

function handleQueryDebts(text = "") {
  const debtsStore = useDebtsStore();
  const normalized = normalizeText(text);

  const iOwe = debtsStore.debts.filter(
    (d) =>
      d.type === "i_owe" &&
      !(d.is_paid || String(d.status || "").toLowerCase() === "paid"),
  );
  const owedToMe = debtsStore.debts.filter(
    (d) =>
      d.type === "owed_to_me" &&
      !(d.is_paid || String(d.status || "").toLowerCase() === "paid"),
  );

  const iOweTotal = iOwe.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
  const owedTotal = owedToMe.reduce(
    (sum, d) => sum + parseFloat(d.amount || 0),
    0,
  );

  let message = "";

  const isAskingOwedByOthers =
    normalized.includes("who owe") ||
    normalized.includes("owes me") ||
    normalized.includes("sino may utang") ||
    normalized.includes("kinsay naay utang") ||
    normalized.includes("kinsay utangan");

  const isAskingOwedByMe =
    normalized.includes("i owe") ||
    normalized.includes("what i owe") ||
    normalized.includes("kanino ako may utang") ||
    normalized.includes("kang kinsa ko naay utang") ||
    normalized.includes("ko naay utang");

  // If they didn't specify, show both. If they did, show only the requested side.
  const showOwedToMe =
    isAskingOwedByOthers || (!isAskingOwedByMe && !isAskingOwedByOthers);
  const showIOwe =
    isAskingOwedByMe || (!isAskingOwedByMe && !isAskingOwedByOthers);

  if (showOwedToMe) {
    if (owedToMe.length > 0) {
      message += `OWED TO YOU ${formatMoney(owedTotal)}\n`;
      message += owedToMe
        .map((d) => `• ${d.name}: ${formatMoney(d.amount)}`)
        .join("\n");
    } else if (isAskingOwedByOthers) {
      message += `There are no outstanding debts owed to you at this time.`;
    }
  }

  if (showIOwe && showOwedToMe && message && iOwe.length > 0) message += "\n\n";

  if (showIOwe) {
    if (iOwe.length > 0) {
      message += `YOU OWE ${formatMoney(iOweTotal)}\n`;
      message += iOwe
        .map((d) => `• ${d.name}: ${formatMoney(d.amount)}`)
        .join("\n");
    } else if (isAskingOwedByMe) {
      message += `You have no outstanding payables. Excellent.`;
    }
  }

  return {
    ok: true,
    message: message.trim() || "No active debts found.",
    kind: "query",
  };
}

function handleQueryBudget() {
  const dashboard = useDashboardStore();
  const spent = parseFloat(
    dashboard.stats.monthly_expenses ?? dashboard.stats.expenses_total ?? 0,
  );
  const monthKey = getMonthKey();
  const customBudget = getMonthlyBudgetLimit(monthKey);

  if (customBudget !== null) {
    const left = parseFloat((customBudget - spent).toFixed(2));
    if (left >= 0) {
      return {
        ok: true,
        message: `Your chat budget this month is ${formatMoney(customBudget)}. You've spent ${formatMoney(spent)}, so you still have ${formatMoney(left)} left.`,
        kind: "query",
      };
    }
    const over = Math.abs(left);
    return {
      ok: true,
      message: `Your chat budget this month is ${formatMoney(customBudget)}. You've spent ${formatMoney(spent)}, which is ${formatMoney(over)} over budget.`,
      kind: "query",
    };
  }

  const left = parseFloat(dashboard.stats.remaining_salary || 0);
  const witty = [`Your remaining budget is ${formatMoney(left)}.`];
  return {
    ok: true,
    message: pickRandom(witty, "query_budget"),
    kind: "query",
  };
}

function handleCreateSavingsGoal() {
  return {
    ok: true,
    message: `Savings goal tracking is coming soon!\n\nFor now, you can create a dedicated wallet (e.g. "Emergency Fund" or "Ipon") and deposit into it manually to track your savings.`,
    kind: "info",
  };
}

// FIXED: set_budget — stubbed until salaryStore supports a direct setter
async function handleSetBudget(text = "", sessionId = "default") {
  const normalized = normalizeText(text);
  const monthKey = getMonthKey();
  const monthLabel = new Date().toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
  const undoWords = ["undo", "revert", "rollback", "bawi", "ibalik"];

  if (undoWords.some((w) => normalized.includes(w))) {
    const undoState = _chatBudgetUndoByMonth.get(monthKey);
    if (!undoState) {
      return {
        ok: false,
        message: `I couldn't find a recent budget change to undo for ${monthLabel}.`,
        kind: "query",
      };
    }

    if (undoState.hadPrevious) {
      setMonthlyBudgetLimit(undoState.previousAmount, monthKey);
      _chatBudgetUndoByMonth.delete(monthKey);
      return {
        ok: true,
        message: `Completed. I restored your ${monthLabel} budget to ${formatMoney(undoState.previousAmount)}.`,
        kind: "action",
      };
    }

    deleteMonthlyBudgetLimit(monthKey);
    _chatBudgetUndoByMonth.delete(monthKey);
    return {
      ok: true,
      message: `Completed. I removed your ${monthLabel} budget limit and switched back to income-based tracking.`,
      kind: "action",
    };
  }

  const amount = extractAmount(text);
  return planAction("set_budget", { amount }, sessionId, text);
}

function _executeSetBudget(amount) {
  const monthKey = getMonthKey();
  const monthLabel = new Date().toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
  const dashboard = useDashboardStore();
  const previousBudget = getMonthlyBudgetLimit(monthKey);
  _chatBudgetUndoByMonth.set(monthKey, {
    hadPrevious: previousBudget !== null,
    previousAmount: previousBudget,
  });
  const budgetLimit = setMonthlyBudgetLimit(amount);
  const spent = parseFloat(
    dashboard.stats.monthly_expenses ?? dashboard.stats.expenses_total ?? 0,
  );
  const left = parseFloat((budgetLimit - spent).toFixed(2));

  if (left >= 0) {
    return {
      ok: true,
      message: `Budget set for ${monthLabel}: ${formatMoney(budgetLimit)}. You've spent ${formatMoney(spent)} so far, leaving ${formatMoney(left)} available.`,
      kind: "action",
    };
  }

  const over = Math.abs(left);
  return {
    ok: true,
    message: `Budget set for ${monthLabel}: ${formatMoney(budgetLimit)}. You've already spent ${formatMoney(spent)}, which is ${formatMoney(over)} over this budget.`,
    kind: "action",
  };
}

// FIXED: multi-turn transfer — asks for missing fromWallet, toWallet, or amount
async function handleTransfer(text, sessionId = "default") {
  const walletsStore = useWalletsStore();
  const amount = extractAmount(text);
  const { from: fromWallet, to: toWallet } = extractTransferWallets(
    text,
    walletsStore.wallets,
  );
  return planAction(
    "transfer",
    { amount, fromWallet, toWallet },
    sessionId,
    text,
  );
}

// FIXED: private transfer executor
async function _executeTransfer(
  fromWallet,
  toWallet,
  amount,
  walletsStore,
  dashboardStore,
  sessionId = "default",
) {
  if (Number(fromWallet.balance) < amount) {
    clearPendingContext(sessionId);
    return {
      ok: false,
      message: `Not enough balance in ${fromWallet.name || fromWallet.type} to transfer ${formatMoney(amount)}.`,
      kind: "query",
    };
  }

  try {
    await walletsStore.adjustBalance(fromWallet.id, -amount);
    await walletsStore.adjustBalance(toWallet.id, amount);
    clearPendingContext(sessionId);

    const fromName = fromWallet.name || fromWallet.type;
    const toName = toWallet.name || toWallet.type;

    setLastBotAction("transfer");
    return {
      ok: true,
      message: `Transferred ${formatMoney(amount)} from ${fromName} to ${toName}.`,
      kind: "action",
    };
  } catch (err) {
    clearPendingContext(sessionId);
    return {
      ok: false,
      message: `Something went wrong with the transfer. Please try again.`,
      kind: "query",
    };
  }
}

// Mapping bridge to harmonize NLU intents with internal handlers
function _mapNluIntent(intentName, entities = {}) {
  if (intentName === "create_debt") {
    return entities.type === "owed_to_me" || entities.type === "owes_me"
      ? "create_debt_owed_to_me"
      : "create_debt_i_owe";
  }
  return intentName;
}

// Centralized intent dispatching
async function _dispatchIntent(intentName, text, sessionId, entities = {}) {
  const mappedIntent = _mapNluIntent(intentName, entities);
  const intentType = getIntentType(mappedIntent);

  // ── ACTION INTENTS: route through deliberative orchestrator ───────────────
  const actionIntents = [
    "log_expense",
    "deposit",
    "create_debt_i_owe",
    "create_debt_owed_to_me",
    "pay_debt",
    "transfer",
    "set_budget",
  ];

  if (actionIntents.includes(mappedIntent)) {
    // Extract entities if not already provided by NLU
    const walletsStore = useWalletsStore();
    const expensesStore = useExpensesStore();
    const debtsStore = useDebtsStore();

    // Ensure entities are populated from text if NLU didn't provide them
    if (!entities.amount) entities.amount = extractAmount(text);
    if (!entities.wallet) entities.wallet = matchWallet(text, walletsStore.wallets);
    if (!entities.category) entities.category = detectCategory(text);
    if (!entities.reason) entities.reason = extractExpenseReason(text, walletsStore.wallets);
    if (!entities.person) entities.person = extractPersonName(text);

    // Special handling for transfer and debt intents
    if (mappedIntent === "transfer") {
      const { from: extractedFrom, to: extractedTo } = extractTransferWallets(
        text,
        walletsStore.wallets,
      );
      if (!entities.fromWallet) entities.fromWallet = extractedFrom;
      if (!entities.toWallet) entities.toWallet = extractedTo;
    }

    if (mappedIntent === "pay_debt") {
      if (debtsStore.debts.length === 0) await debtsStore.fetchAll();
      const debtsResult = findDebtByName(text, debtsStore.debts);
      if (!entities.debtId && debtsResult.match) entities.debtId = debtsResult.match.id;
    }

    // Normalize debt type for orchestrator
    if (mappedIntent === "create_debt_i_owe") {
      entities.type = "i_owe";
    } else if (mappedIntent === "create_debt_owed_to_me") {
      entities.type = "owed_to_me";
    }

    // Route through deliberative orchestrator
    const orchestratorIntent = mappedIntent.startsWith("create_debt_")
      ? "create_debt"
      : mappedIntent;
    const result = await planAction(orchestratorIntent, entities, sessionId, text);
    return result ? { ...result, intentType } : null;
  }

  // ── QUERY INTENTS: direct routing (existing behavior preserved) ────────────
  let result = null;
  if (mappedIntent === "query_balance")
    result = await handleQueryBalance(text);
  else if (mappedIntent === "query_expenses")
    result = await handleQueryExpenses(text);
  else if (mappedIntent === "query_missing_wallets")
    result = handleMissingWalletsQuery(text);
  else if (mappedIntent === "query_debts")
    result = await handleQueryDebts(text);
  else if (mappedIntent === "query_budget") result = await handleQueryBudget();
  else if (mappedIntent === "ask_help")
    result = { ok: true, message: HELP_MESSAGE, kind: "help" };
  else if (mappedIntent === "ask_tips") {
    const dashboard = useDashboardStore();
    result = {
      ok: true,
      message: financeTipFromStats(dashboard.stats),
      kind: "tip",
    };
  } else if (mappedIntent === "flow_help") result = handleFlowHelp(text, entities || {});
  else if (mappedIntent === "create_savings_goal")
    result = handleCreateSavingsGoal();
  else if (mappedIntent === "create_wallet") {
    result = await handleCreateWallet(text, sessionId, entities);
  }

  if (result) {
    return { ...result, intentType };
  }
  return null;
}

function getIntentDisplayName(intent) {
  if (intent === "log_expense") return "expense logging";
  if (intent === "deposit") return "deposit";
  if (intent === "transfer") return "transfer";
  if (intent === "create_debt" || intent === "create_debt_i_owe" || intent === "create_debt_owed_to_me") return "debt tracking";
  if (intent === "pay_debt") return "debt payment";
  if (intent === "set_budget") return "budget setup";
  if (intent === "create_wallet") return "wallet creation";
  return intent.replace(/_/g, " ");
}

function getIntentVerbPhrase(intent) {
  if (intent === "log_expense") return "log an expense";
  if (intent === "deposit") return "make a deposit";
  if (intent === "transfer") return "make a transfer";
  if (intent === "create_debt" || intent === "create_debt_i_owe" || intent === "create_debt_owed_to_me") return "track a debt";
  if (intent === "pay_debt") return "pay a debt";
  if (intent === "set_budget") return "set a budget";
  if (intent === "create_wallet") return "create a wallet";
  return intent.replace(/_/g, " ");
}

async function executeAiAction(aiData, aiProvider, text, sessionId) {
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();
  const debtsStore = useDebtsStore();
  const salaryStore = useSalaryStore();
  const expensesStore = useExpensesStore();
  const aiEntities = {};

  // Map AI-extracted fields to local entity format
  if (aiData.amount) aiEntities.amount = Number(aiData.amount);
  if (aiData.category) aiEntities.category = aiData.category;
  if (aiData.reason) aiEntities.reason = aiData.reason;

  // Match wallet names to actual wallet objects
  if (aiData.wallet_name) {
    aiEntities.wallet = matchWallet(aiData.wallet_name, walletsStore.wallets);
    aiEntities.walletName = aiData.wallet_name;
  }
  if (aiData.wallet_type) {
    aiEntities.walletType = aiData.wallet_type;
  }
  if (aiData.from_wallet) {
    aiEntities.fromWallet = matchWallet(aiData.from_wallet, walletsStore.wallets);
  }
  if (aiData.to_wallet) {
    aiEntities.toWallet = matchWallet(aiData.to_wallet, walletsStore.wallets);
  }

  // Debt fields
  if (aiData.person) aiEntities.person = aiData.person;
  if (aiData.debt_type) aiEntities.type = aiData.debt_type;

  // Wallet creation fields
  if (aiData.balance !== undefined) aiEntities.balance = Number(aiData.balance);

  // Map the AI action to local intent name
  let localIntent = aiData.action;
  if (localIntent === "create_debt" && aiEntities.type === "i_owe") {
    localIntent = "create_debt_i_owe";
  } else if (localIntent === "create_debt" && aiEntities.type === "owed_to_me") {
    localIntent = "create_debt_owed_to_me";
  }

  // Dispatch through local engine
  const result = await _dispatchIntent(localIntent, text, sessionId, aiEntities);
  if (result) {
    return { ...result, aiProvider };
  }
  return null;
}

// FIXED: sessionId allows multi-tab/session-safe pending context handling
export async function processEleFamMessage(
  message = "",
  sessionId = "default",
) {
  let text = String(message || "").trim();
  if (!text) {
    return { ok: false, message: "Please type a finance question or command." };
  }

  await ensureLoaded();

  // Inject fallback context seamlessly into the user's next message
  const fallbackCtx = getPendingContext(sessionId);
  if (fallbackCtx && fallbackCtx.intent === "smart_fallback") {
    if (fallbackCtx.walletType && !extractWalletTypeFromText(text)) {
      text = `${fallbackCtx.walletType} ${text}`;
    }
    if (fallbackCtx.amount && !extractAmount(text)) {
      text = `${fallbackCtx.amount} ${text}`;
    }
    deletePendingContext(sessionId);
  }

  // FIXED: use TTL-aware Map, protect against accidental intent hijacking
  const existingCtx = getPendingContext(sessionId);
  if (existingCtx) {
    const pendingSmallTalk = detectSmallTalk(text);
    const normalized = normalizeText(text);

    // Check if the current context is confirm_interruption
    if (existingCtx.intent === "confirm_interruption") {
      const isAffirmative = pendingSmallTalk === "affirmative" || [
        "yes", "continue", "sige", "ituloy", "okay", "ok", "go", "proceed", "sige na", "yes please", "sure"
      ].some(w => normalized.includes(w));

      const isNegative = pendingSmallTalk === "negative" || pendingSmallTalk === "cancel" || [
        "no", "cancel", "wag na", "stop", "ayaw na", "huwag na", "nevermind", "abort", "huwag"
      ].some(w => normalized.includes(w));

      if (isAffirmative) {
        // Restore the original context
        const prevCtx = existingCtx.previousCtx;
        setPendingContext(sessionId, prevCtx);

        let promptMsg = "";
        if (prevCtx.intent === "create_wallet") {
          promptMsg = `Understood. What's the starting balance for your ${prevCtx.walletName} wallet? Reply with an amount, or say "0" if it's empty right now.`;
        } else {
          let required = [...(REQUIRED_FIELDS[prevCtx.intent] || [])];
          if (prevCtx.intent === "create_debt" && prevCtx.entities.type === "owed_to_me") {
            if (!required.includes("walletId")) {
              required.push("walletId");
            }
          }
          const missing = required.filter(f => prevCtx.entities[f] === null || prevCtx.entities[f] === undefined);
          if (missing.length > 0) {
            promptMsg = askForMissingField(missing[0], prevCtx);
          } else {
            promptMsg = "What is the next detail?";
          }
        }

        return {
          ok: true,
          message: `Okay, let's continue with your ${getIntentDisplayName(prevCtx.intent)}. ${promptMsg}`,
          kind: "question",
          intentType: "action"
        };
      } else if (isNegative) {
        // Discard the previous context and stop!
        deletePendingContext(sessionId);
        const prevDisp = getIntentDisplayName(existingCtx.previousCtx.intent);
        return {
          ok: true,
          message: `Okay, the ${prevDisp} has been cancelled.`,
          kind: "action",
          intentType: "action"
        };
      } else {
        const prevDisp = getIntentDisplayName(existingCtx.previousCtx.intent);
        return {
          ok: true,
          message: `You still have an unfinished ${prevDisp}. Do you want to continue it? (Please reply with yes/continue or no/cancel)`,
          kind: "question",
          intentType: "action"
        };
      }
    }
    if (pendingSmallTalk === "cancel") {
      clearPendingContext(sessionId);
      return {
        ok: true,
        message: getSmallTalkReply("cancel"),
        kind: "text",
        intentType: "query",
      };
    }
    if (pendingSmallTalk === "negative") {
      clearPendingContext(sessionId);
      return {
        ok: true,
        message: getSmallTalkReply("negative", getLastBotAction()),
        kind: "text",
        intentType: "query",
      };
    }
    if (pendingSmallTalk) {
      return {
        ok: true,
        message: `${getSmallTalkReply(pendingSmallTalk, getLastBotAction())}${getPendingReminder(existingCtx)}`,
        kind: "text",
        intentType: "query",
      };
    }

    const incomingNlu = advancedClassify(text);
    const incomingIntentName = incomingNlu.intent;
    const isLocalNewIntent =
      incomingNlu.matched &&
      incomingIntentName &&
      incomingIntentName !== "unknown" &&
      incomingIntentName !== "ambiguous";
    const isCancelWord = [
      "cancel",
      "nevermind",
      "never mind",
      "abort",
      "terminate",
      "stop this",
      "wag na",
      "ayaw na",
      "huwag na",
    ].some((w) => normalizeText(text).includes(w));

    if (isCancelWord) {
      clearPendingContext(sessionId);
      return {
        ok: true,
        message: getSmallTalkReply("cancel"),
        kind: "text",
        intentType: "query",
      };
    }

    let aiIncomingIntent = null;
    let aiData = null;
    let aiProvider = null;

    if (!isLocalNewIntent) {
      try {
        const interpretResponse = await api.post("/chat/interpret", {
          message: text,
        });
        if (interpretResponse.data?.success && interpretResponse.data?.data) {
          aiData = interpretResponse.data.data;
          aiProvider = interpretResponse.data.provider;
          if (aiData.action && aiData.action !== "reply") {
            let localIntent = aiData.action;
            if (localIntent === "create_debt" && aiData.debt_type === "i_owe") {
              localIntent = "create_debt_i_owe";
            } else if (localIntent === "create_debt" && aiData.debt_type === "owed_to_me") {
              localIntent = "create_debt_owed_to_me";
            }
            aiIncomingIntent = localIntent;
          }
        }
      } catch (err) {
        console.warn("[EleFam AI] Interpret API error during pending context check:", err);
      }
    }

    const resolvedIntentName = incomingIntentName || aiIncomingIntent;
    const isNewIntent = isLocalNewIntent || !!aiIncomingIntent;

    // Verify trigger words before prompting interruption to avoid false positives on slot-filling answers (e.g. "800 on cash")
    let isRealInterruption = isNewIntent && resolvedIntentName !== existingCtx.intent;
    if (isRealInterruption) {
      const mappedIncomingIntent = _mapNluIntent(
        resolvedIntentName,
        incomingNlu.entities || aiData || {},
      );
      const incomingIntentType = getIntentType(mappedIncomingIntent);
      if (incomingIntentType === "action") {
        // 1. If text contains trigger words for the pending intent (existingCtx.intent), it's a continuation, not an interruption.
        const hasPendingTrigger = hasExplicitActionTrigger(text, existingCtx.intent);
        // 2. If the text does NOT contain trigger words for the new intent, it's not a real new intent command.
        const hasNewTrigger = hasExplicitActionTrigger(text, resolvedIntentName);
        if (hasPendingTrigger || !hasNewTrigger) {
          isRealInterruption = false;
        }
      }
    }

    if (isRealInterruption) {
      const mappedIncomingIntent = _mapNluIntent(
        resolvedIntentName,
        incomingNlu.entities || aiData || {},
      );
      const intentType = getIntentType(mappedIncomingIntent);
      if (intentType === "action") {
        setPendingContext(sessionId, {
          intent: "confirm_interruption",
          previousCtx: existingCtx,
          newText: text,
          newIntent: resolvedIntentName,
        });
        const prevDisp = getIntentDisplayName(existingCtx.intent);
        return {
          ok: true,
          message: `You still have an unfinished ${prevDisp}. Do you want to continue it? (Please reply with yes/continue or no/cancel)`,
          kind: "question",
          intentType: "action",
        };
      }
      const result = aiIncomingIntent
        ? await executeAiAction(aiData, aiProvider, text, sessionId)
        : await _dispatchIntent(
            incomingIntentName,
            text,
            sessionId,
            incomingNlu.entities || {},
          );

      if (result) {
        if (intentType === "query") {
          const reminder = getPendingReminder(existingCtx);
          const reminderText = reminder ? `\n\n${reminder.trim()}` : "";
          return {
            ...result,
            message: `${result.message}${reminderText}`,
            reminder: reminder ? reminder.trim() : undefined,
            intentType,
          };
        } else {
          deletePendingContext(sessionId);
          return {
            ...result,
            intentType,
          };
        }
      }
    }

    deletePendingContext(sessionId);
    if (existingCtx.intent === "create_wallet") {
      const result = await resolveCreateWallet(text, existingCtx, sessionId);
      return { ...result, intentType: "action" };
    }
    // Refactored: handle all supported intents via resolvePendingContext
    if (REQUIRED_FIELDS[existingCtx.intent]) {
      const result = await resolvePendingContext(text, existingCtx, sessionId);
      return { ...result, intentType: "action" };
    }
  }

  // ================================================================
  // THE 9-LAYER NLU PIPELINE
  // Replaces all rigid if/else checks with sequential resolution
  // ================================================================
  const normalized = normalizeText(text);

  // Call refactored advancedClassify
  const nluResult = advancedClassify(text);

  // Determine if local NLU matched confidently and completely
  const mappedIntentForType = nluResult.matched ? _mapNluIntent(nluResult.intent, nluResult.entities || {}) : null;
  const intentType = mappedIntentForType ? getIntentType(mappedIntentForType) : null;
  const isActionIntent = intentType === "action";

  let isConfidentAndComplete = false;
  if (nluResult.matched && nluResult.intent !== "unknown" && nluResult.intent !== "ambiguous" && nluResult.intent !== "out_of_scope") {
    if (intentType === "query" || nluResult.sourceLayer === "knowledge") {
      if (nluResult.confidence >= 0.85) {
        isConfidentAndComplete = true;
      }
    } else if (isActionIntent) {
      const orchestratorIntent = mappedIntentForType.startsWith("create_debt") ? "create_debt" : mappedIntentForType;
      const required = REQUIRED_FIELDS[orchestratorIntent] || [];
      const missing = required.filter(field => {
        const val = nluResult.entities?.[field];
        if (val === null || val === undefined) return true;
        if (typeof val === "string" && val.trim() === "") return true;
        if (orchestratorIntent === "log_expense" && field === "category" && val === "expense") return true;
        return false;
      });

      if (missing.length === 0 && nluResult.confidence >= 0.95) {
        isConfidentAndComplete = true;
      }
    }
  }

  // 1. If it is confident and complete, execute it locally!
  if (isConfidentAndComplete) {
    if (nluResult.sourceLayer === "knowledge") {
      return {
        ok: true,
        message: getSmallTalkReply(nluResult.intent, getLastBotAction()),
        kind: "text",
        intentType: "query",
      };
    }
    return _dispatchIntent(
      nluResult.intent,
      text,
      sessionId,
      nluResult.entities,
    );
  }

  // 2. Otherwise, try AI interpretation first!
  try {
    const interpretResponse = await api.post("/chat/interpret", {
      message: text,
    });

    if (interpretResponse.data?.success && interpretResponse.data?.data) {
      const aiData = interpretResponse.data.data;

      // If the AI identified an action, route it through local execution
      if (aiData.action && aiData.action !== "reply") {
        const result = await executeAiAction(aiData, interpretResponse.data.provider, text, sessionId);
        if (result) return result;
      }

      // If AI returned a reply (not an action), show it as text
      if (aiData.action === "reply" && aiData.message) {
        return {
          ok: true,
          message: aiData.message,
          kind: "text",
          intentType: "query",
          aiProvider: interpretResponse.data.provider,
        };
      }
    }
  } catch (err) {
    console.warn("[EleFam AI] Interpret API error, falling back to local processing:", err);
  }

  // 3. Fallbacks if AI interpretation failed or returned no actionable intent:

  // Handle Ambiguous
  if (nluResult.intent === "ambiguous") {
    const candidates = nluResult.candidates;
    return {
      ok: true,
      message: `Did you mean ${candidates[0].intent.replace(/_/g, " ")} or ${candidates[1].intent.replace(/_/g, " ")}?`,
      kind: "text",
      intentType: "query",
    };
  }

  // Handle out-of-scope understanding (meaning understood, but outside app scope)
  if (nluResult.intent === "out_of_scope") {
    const scopeType = nluResult.entities?.scopeType || "general";
    return {
      ok: false,
      message:
        scopeType === "technical"
          ? TECHNICAL_GUARD_REPLY
          : eleFamProfile.guardReply,
      kind: "text",
      intentType: "query",
    };
  }

  // Handle Knowledge (Smalltalk)
  if (nluResult.sourceLayer === "knowledge") {
    return {
      ok: true,
      message: getSmallTalkReply(nluResult.intent, getLastBotAction()),
      kind: "text",
      intentType: "query",
    };
  }

  // Handle matched intents (Template, Synonym, Fuzzy)
  if (nluResult.matched && nluResult.intent !== "unknown") {
    return _dispatchIntent(
      nluResult.intent,
      text,
      sessionId,
      nluResult.entities,
    );
  }

  // Fall back to conversational AI if it is not a matched action intent
  if (!isActionIntent) {
    try {
      const dashboardStore = useDashboardStore();
      const customBudget = getMonthlyBudgetLimit();
      const response = await api.post("/chat/message", {
        message: text,
        stats: {
          monthly_income: parseFloat(dashboardStore.stats.monthly_income || 0),
          monthly_expenses: parseFloat(dashboardStore.stats.monthly_expenses || 0),
          remaining_salary: parseFloat(dashboardStore.stats.remaining_salary || 0),
          custom_budget: customBudget,
        }
      });
      if (response.data && response.data.enabled) {
        return {
          ok: response.data.ok ?? true,
          message: response.data.message,
          kind: nluResult.intent === "ask_tips" ? "tip" : "text",
          intentType: mappedIntentForType ? getIntentType(mappedIntentForType) : "query",
        };
      }
    } catch (err) {
      console.warn("[EleFam AI] Chat API error, falling back to local fallback:", err);
    }
  }

  // Fall back to smart fallback
  const fallbackResponse = nluResult.fallbackResponse || generateSmartFallback(text, null);
  if (fallbackResponse?.context) {
    setPendingContext(sessionId, {
      intent: "smart_fallback",
      ...fallbackResponse.context,
    });
  }
  return {
    ok: false,
    message: fallbackResponse?.message || getSmallTalkReply("unknown"),
    kind: isFinanceRelated(normalized) ? "query" : "text",
  };

  // Absolute baseline fallback (should rarely be reached)
  return {
    ok: false,
    message: getSmallTalkReply("unknown"),
    kind: "query",
  };
}
