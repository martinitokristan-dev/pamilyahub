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
  sanitizeExpenseReason,
  sanitizePlanReason,
  isBarePlanTrigger,
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
import { resolveWalletIconType } from "@/lib/walletIcons.js";

import { useExpensesStore } from "@/stores/expenses.js";
import { useWalletsStore } from "@/stores/wallets.js";
import { useDebtsStore } from "@/stores/debts.js";
import { useSalaryStore } from "@/stores/salary.js";
import { useDashboardStore } from "@/stores/dashboard.js";
import { usePlansStore } from "@/stores/plans.js";
import { shouldFetchFromServer } from "@/lib/syncEngine.js";
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
  APP_COMMANDS_HELP,
} from "@/lib/chatKnowledge.js";

import { advancedClassify } from "@/lib/chatNlu.js";
import { generateSmartFallback } from "@/lib/chatSmartFallback.js";
import { detectHowToFlowQuestion } from "@/lib/chatQuestion.js";
import { transferService } from "@/services/transferService.js";
import { outboxAdd } from "@/lib/offlineDb.js";
import { refreshPendingCount } from "@/lib/syncEngine.js";
import { notifyFinanceActivity } from "@/lib/financeEvents.js";
import api from "@/lib/axios.js";
import chatRules from "@/lib/chatRules.json";
import { ENGLISH_LEXICON } from "@/lib/knowledge/index.js";

// ─── Rules loaded from chatRules.json (single source of truth) ───────────────
// Add new verbs and patterns by editing chatRules.json — no code changes needed.
export const ACTION_TRIGGER_WORDS = {
  log_expense:   chatRules.expense_verbs,
  deposit:       chatRules.deposit_verbs,
  transfer:      chatRules.transfer_verbs,
  create_debt:   chatRules.debt_owe_verbs,
  pay_debt:      chatRules.pay_debt_verbs,
  set_budget:    ["budget", "limit"],
  create_wallet: ["wallet", "create", "gawa"],
};

// Hydrate regex patterns from chatRules.json string patterns into real RegExp objects
export const CHAT_REGEX_PATTERNS = (chatRules.regex_patterns || []).map((p) => ({
  intent:  p.intent,
  regex:   new RegExp(p.pattern, "i"),
  groups:  p.groups,
}));

/**
 * Loads rules dynamically from the backend and updates the memory references.
 */
export async function loadRemoteChatRules() {
  try {
    const res = await api.get('/chat/rules');
    const rules = res.data;
    if (rules) {
      if (Array.isArray(rules.expense_verbs)) ACTION_TRIGGER_WORDS.log_expense = rules.expense_verbs;
      if (Array.isArray(rules.deposit_verbs)) ACTION_TRIGGER_WORDS.deposit = rules.deposit_verbs;
      if (Array.isArray(rules.transfer_verbs)) ACTION_TRIGGER_WORDS.transfer = rules.transfer_verbs;
      if (Array.isArray(rules.debt_owe_verbs)) ACTION_TRIGGER_WORDS.create_debt = rules.debt_owe_verbs;
      if (Array.isArray(rules.pay_debt_verbs)) ACTION_TRIGGER_WORDS.pay_debt = rules.pay_debt_verbs;

      if (Array.isArray(rules.regex_patterns)) {
        CHAT_REGEX_PATTERNS.length = 0;
        rules.regex_patterns.forEach((p) => {
          CHAT_REGEX_PATTERNS.push({
            intent:  p.intent,
            regex:   new RegExp(p.pattern, "i"),
            groups:  p.groups,
          });
        });
      }
    }
  } catch (err) {
    console.warn("[EleFam AI] Failed to load remote chat rules:", err);
  }
}


// to prevent race conditions and stale context execution
const _pendingContexts = new Map();
const _requiresFullSentenceFlags = new Map();
const PENDING_CONTEXT_TTL = 12 * 60 * 60 * 1000; // 12 hours
const _lastPickedIndex = new Map();
const _chatBudgetByMonth = new Map();
const _chatBudgetUndoByMonth = new Map();
const CHAT_BUDGET_STORAGE_KEY = "elefam_chat_budget_by_month";
const _sessionLastAction = new Map();

/** Disambiguation picker (pay_plan / pay_debt) — separate from slot-filling pending context */
let pendingAction = null;

function clearPendingAction() {
  pendingAction = null;
}

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
}

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
  create_plan: ["reason", "amount", "date"],
  pay_plan: ["reason", "amount", "wallet"],
  set_budget: ["amount"],
};

function getRequiredFields(intent, entities = {}) {
  const baseIntent = intent.startsWith("create_debt") ? "create_debt" : intent;
  const required = [...(REQUIRED_FIELDS[baseIntent] || [])];
  if (baseIntent === "create_debt" && (entities?.type === "owed_to_me" || entities?.type === "owes_me")) {
    if (!required.includes("walletId")) {
      required.push("walletId");
    }
  }
  return required;
}

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

  if (intent === "pay_plan" && entities._resolvedPlan) {
    const planAmount = parseFloat(entities._resolvedPlan.amount);
    if (!entities.amount || entities.amount <= 0) {
      entities.amount = planAmount;
    }
  }

  if (intent === "log_expense") {
    entities.reason = sanitizeExpenseReason(entities.reason);
  }

  if (intent === "create_plan") {
    if (!entities.date) {
      const parsedDate = extractDueDateFromText(rawText);
      if (parsedDate) entities.date = parsedDate;
    }
    if (!entities.recurrence) {
      entities.recurrence = detectRecurrenceFromText(rawText);
    }
    if (!entities.reason && rawText && !isBarePlanTrigger(rawText)) {
      const inferredReason = sanitizePlanReason(
        extractExpenseReason(rawText, walletsStore.wallets),
        rawText,
      );
      if (inferredReason) entities.reason = inferredReason;
    }
  }

  // ── STAGE 1: VALIDATE REQUIRED FIELDS ───────────────────────────────
  const required = getRequiredFields(intent, entities);
  const missing = required.filter((field) => {
    const val = entities[field];
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    // Special case: category "expense" is not a real category
    if (
      intent === "log_expense" &&
      field === "category" &&
      val === "expense" &&
      !entities.reason
    )
      return true;
    return false;
  });

  // ── STAGE 2: PLAN NEXT ACTION ────────────────────────────────────────
  if (missing.length > 0) {
    // Missing fields → ask follow-up
    let nextField = missing[0];

    // Check for ambiguous debt matches when debtId is missing in pay_debt
    let ambiguousDebts = undefined;
    if (intent === "pay_debt" && nextField === "debtId") {
      const debtsStore = useDebtsStore();
      if (debtsStore.debts.length === 0) await debtsStore.fetchAll();
      const debtsResult = findDebtByName(rawText, debtsStore.debts);
      if (debtsResult.match) {
        entities.debtId = debtsResult.match.id;
        // Re-evaluate missing fields now that debtId is resolved
        const newMissing = getRequiredFields(intent, entities).filter((field) => {
          const val = entities[field];
          if (val === null || val === undefined) return true;
          if (typeof val === "string" && val.trim() === "") return true;
          return false;
        });
        if (newMissing.length === 0) {
          clearPendingContext(sessionId);
          return executeIntent(intent, entities, sessionId);
        }
        nextField = newMissing[0];
      } else if (debtsResult.ambiguous) {
        ambiguousDebts = debtsResult.ambiguous;
      }
    }

    const nextCtx = {
      intent,
      entities,
      ...(ambiguousDebts ? { ambiguousDebts } : {})
    };

    setPendingContext(sessionId, nextCtx);
    let prefix = "";
    if (rawText) {
      const howTo = detectHowToFlowQuestion(rawText);
      if (howTo) {
        prefix = getHowToPrefix(intent);
      }
    }
    const question = prefix + askForMissingField(nextField, nextCtx);
    return {
      ok: false,
      message: question,
      kind: "question",
      intentType: "action",
    };
  }

  // ── STAGE 3: EXECUTE (all fields present) ────────────────────────────
  clearPendingContext(sessionId);
  if (rawText) entities._sourceText = rawText;
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
  if (intentName === "create_plan") {
    if (!entities.reason) return `I'm still waiting for the name of the plan or bill.`;
    if (!entities.amount) return `I'm still waiting for the amount of the plan.`;
    if (!entities.date) return `I'm still waiting for the due date of the plan.`;
  }
  if (intentName === "pay_plan") {
    if (!entities.reason) return `I'm still waiting for which plan you want to pay.`;
    if (!entities.amount) return `I'm still waiting for how much you paid.`;
    if (!entities.wallet) return `I'm still waiting for which wallet to deduct the payment from.`;
  }
  return "";
}

// FIXED: now accepts sessionId so callers can clear the right session
export function clearPendingContext(sessionId = "default") {
  deletePendingContext(sessionId);
}

function askForMissingField(field, pendingCtx) {
  if (!field) {
    if (pendingCtx?.intent === "create_wallet") {
      return `What's the starting balance for your ${pendingCtx.walletName} wallet? Reply with an amount, or say "0" if it's empty right now.`;
    }
    return "Can you give me a bit more detail?";
  }
  const intent = pendingCtx.intent;
  const walletsStore = useWalletsStore();
  const walletList = walletsStore.wallets.map((w) => w.name).join(", ");
  if (field === "amount") {
    if (intent === "deposit")
      return "How much are you depositing? Just type a number.";
    if (intent === "log_expense") return "How much did you spend?";
    if (intent === "transfer") return "How much do you want to transfer?";
    if (intent === "create_debt") return "How much is the debt amount?";
    if (intent === "create_plan" || intent === "pay_plan") return "How much is the plan amount?";
    if (intent === "pay_debt") {
      const debtsStore = useDebtsStore();
      const debt = debtsStore.debts.find(
        (d) => String(d.id) === String(pendingCtx.entities.debtId),
      );
      if (debt) {
        if (debt.type === "owed_to_me") {
          return `How much did ${debt.name} pay you?`;
        } else if (debt.type === "i_owe") {
          return `How much did you pay ${debt.name}?`;
        }
      }
      return "How much did you pay?";
    }
    if (intent === "set_budget") return "How much limit would you like to set? (e.g. 12000)";
    if (intent === "create_wallet") {
      return `What's the starting balance for your ${pendingCtx.walletName} wallet? Just type a number like "500" or "0" if it's empty.`;
    }
    return "How much did you spend?";
  }
  if (field === "wallet") {
    const suffix = walletList ? `\n(${walletList})` : "";
    if (intent === "deposit") return `Which wallet are you depositing to?${suffix}`;
    if (intent === "log_expense") return `Which wallet did you use?${suffix}`;
    if (intent === "pay_plan") return `Which wallet did you use to pay the plan?${suffix}`;
    return `Which wallet?${suffix}`;
  }
  if (field === "reason") {
    if (intent === "create_plan") return "What is the name of the bill or plan?";
    if (intent === "pay_plan") return "Which bill or plan are you paying?";
    return "What is the reason?";
  }
  if (field === "date") {
    return "When is the due date? (e.g., June 30 or next Friday)";
  }
  if (field === "category") {
    if (intent === "log_expense") return "What is it for? (e.g. food, transpo)";
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

function getHowToPrefix(intent) {
  if (intent === "deposit") return "To make a deposit, you can tell me something like 'Deposit 1000 to Cash'. Or, I can do it for you right now! ";
  if (intent === "log_expense") return "To log an expense, you can say 'Spent 500 for food from Cash'. Or, I can log it for you right now! ";
  if (intent === "transfer") return "To transfer money, you can say 'Transfer 500 from Cash to GCash'. Or, I can do it for you right now! ";
  if (intent === "create_debt") return "To track a debt, you can say 'John owes me 500' or 'I owe John 500'. Or, I can record it for you right now! ";
  if (intent === "pay_debt") return "To pay a debt, you can say 'I paid John 500'. Or, I can log the payment for you right now! ";
  if (intent === "set_budget") return "To set a budget, you can say 'Set budget to 15000'. Or, I can set it for you right now! ";
  if (intent === "create_wallet") return "To create a wallet, you can say 'New wallet Travel Fund'. Or, I can create it for you right now! ";
  return "";
}

async function executeIntent(intent, entities, sessionId) {
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();
  const debtsStore = useDebtsStore();
  const salaryStore = useSalaryStore();
  const expensesStore = useExpensesStore();
  const plansStore = usePlansStore();

  if (intent === "deposit") {
    const result = await _executeDeposit(
      entities.amount,
      entities.wallet,
      salaryStore,
      dashboardStore,
      entities._sourceText || "",
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
  if (intent === "create_plan") {
    const result = await _executeCreatePlan(
      entities.reason,
      entities.amount,
      entities.date,
      entities.recurrence,
      plansStore,
      dashboardStore,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "pay_plan") {
    const result = await executePayPlan(
      entities._resolvedPlan || null,
      entities.amount,
      entities.wallet,
      sessionId,
      entities.reason,
    );
    if (result?.ok) rememberSessionAction(sessionId, intent, entities);
    return result;
  }
  if (intent === "view_plans") {
    return _executeViewPlans(plansStore);
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

  let required = getRequiredFields(pendingCtx.intent, pendingCtx.entities);
  const missingBefore = required.filter((field) => {
    const val = pendingCtx.entities[field];
    if (!val) return true;
    // Match the same special case as the final validation check
    if (
      pendingCtx.intent === "log_expense" &&
      field === "category" &&
      val === "expense" &&
      !pendingCtx.entities.reason
    ) return true;
    return false;
  });

  const inferredFromContext = inferFollowupEntitiesFromContext(
    text,
    pendingCtx,
    sessionId,
    missingBefore,
    walletsStore.wallets,
  );
  Object.assign(newEntities, inferredFromContext);

  const extractedAmount = extractAmount(text);
  if (
    extractedAmount &&
    extractedAmount > 0 &&
    pendingCtx.intent !== "create_plan"
  ) {
    newEntities.amount = extractedAmount;
  }

  const matchedWallet = matchWallet(text, walletsStore.wallets);

  if (pendingCtx.intent === "deposit" || pendingCtx.intent === "log_expense" || pendingCtx.intent === "pay_plan") {
    if (matchedWallet) newEntities.wallet = matchedWallet;
  }

  if (pendingCtx.intent === "pay_plan") {
    if (!pendingCtx.entities._resolvedPlan) {
      const plansStore = usePlansStore();
      if (!plansStore.fetched) await plansStore.fetchAll(true);
      const unpaid = plansStore.plans.filter((p) => !p.is_paid);
      const planResult = findPlanByName(text, unpaid);
      if (planResult.match) {
        newEntities.reason = planResult.match.title;
        newEntities._resolvedPlan = planResult.match;
      } else if (planResult.ambiguous) {
        pendingCtx.ambiguousPlans = planResult.ambiguous;
      } else {
        const extractedReason = extractExpenseReason(text, walletsStore.wallets);
        if (extractedReason) newEntities.reason = extractedReason;
      }
    }
    const resolved = pendingCtx.entities._resolvedPlan || newEntities._resolvedPlan;
    if (resolved && (!pendingCtx.entities.amount || pendingCtx.entities.amount <= 0)) {
      newEntities.amount = parseFloat(resolved.amount);
    }
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

  if (pendingCtx.intent === "create_plan") {
    if (missingBefore.includes("reason")) {
      const inferredReason = sanitizePlanReason(
        extractExpenseReason(text, walletsStore.wallets),
        text,
      );
      if (inferredReason) {
        newEntities.reason = inferredReason;
      } else if (
        text.trim().length >= 2 &&
        !/^(what|how|where|who|when|why|show|list|can you|help)\b/i.test(normalizeText(text)) &&
        extractAmount(text) === null &&
        !parseDueDate(text) &&
        !extractDueDateFromText(text)
      ) {
        const name = text.trim();
        newEntities.reason = name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    if (missingBefore.includes("amount")) {
      const amt = extractAmount(text);
      if (amt && amt > 0) newEntities.amount = amt;
    }
    if (missingBefore.includes("date")) {
      const parsedDate = parseDueDate(text) || extractDueDateFromText(text);
      if (parsedDate) newEntities.date = parsedDate;
      const recurrence = detectRecurrenceFromText(text);
      if (recurrence) newEntities.recurrence = recurrence;
    }
  }

  if (pendingCtx.intent === "log_expense") {
    const answeringWallet = missingBefore.includes("wallet") && matchedWallet;
    if (!answeringWallet) {
      const extractedCategory = detectCategory(text);
      const reason = sanitizeExpenseReason(
        extractExpenseReason(text, walletsStore.wallets),
      );

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
        newEntities.category = "expense";
      }
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
    'Hi! I\'m Marti, your finance assistant. Type "/help" to see what you can do, or just tell me what you need — like "spent 500 on food" or "add a new plan".',
  guardReply:
    'I can only help with finance flows in this app: add wallet, deposit, transfer, log expense, debt tracking, and budget checks. You can type "/help" for commands.',
};

const TECHNICAL_GUARD_REPLY =
  "I can't answer technical or developer questions. I only guide finance flows in this app like adding wallets, depositing, transferring, logging expenses, debt tracking, and budget.";

const FLOW_ONLY_FALLBACK =
  'I can help with finance flows only. Try asking: "how to add wallet", "how to deposit", "how to transfer", "how to log expense", "how to track debt", or "how to check budget".';

const HELP_MESSAGE = APP_COMMANDS_HELP;

const SYSTEM_WALLET_TYPES = WALLET_DEFINITIONS;

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stripMarkdownFormatting(text = "") {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function normalizeHelpReply(message = "") {
  const cleaned = stripMarkdownFormatting(message);
  const n = normalizeText(cleaned);
  if (
    /welcome to elefam/.test(n) &&
    (/new wallet|manage your finances|these commands/.test(n))
  ) {
    return APP_COMMANDS_HELP;
  }
  return cleaned;
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
  if (!wallets.fetched && !wallets.loading) loaders.push(wallets.fetchAll().catch(() => { }));
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
    if (!name) return false;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    return regex.test(normalizedInput);
  });
  if (fullMatches.length === 1) return { match: fullMatches[0] };
  if (fullMatches.length > 1) {
    // If all matches have the exact same lowercase name, just pick the first one 
    // to avoid asking "Which kyla do you mean? kyla or Kyla?"
    const firstLower = normalizeText(fullMatches[0].name);
    const allSameName = fullMatches.every(d => normalizeText(d.name) === firstLower);
    if (allSameName) {
      return { match: fullMatches[0] };
    }
    return { ambiguous: fullMatches };
  }

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
  if (partialMatches.length > 1) {
    const firstLower = normalizeText(partialMatches[0].name);
    const allSameName = partialMatches.every(d => normalizeText(d.name) === firstLower);
    if (allSameName) {
      return { match: partialMatches[0] };
    }
    return { ambiguous: partialMatches };
  }

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
    "pay", "paid", "bayad", "nagbayad", "plan", "bill", "bills",
    "upcoming", "subscription", "monthly", "on", "in", "at", "for",
    "with", "from", "to", "the", "a", "i", "me", "my", "please",
    "cash", "wallet", "gcash", "maya", "bpi", "bdo", "coins",
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
  if (partialMatches.length > 1) {
    const firstLower = normalizeText(partialMatches[0].title);
    if (partialMatches.every((p) => normalizeText(p.title) === firstLower)) {
      return { match: partialMatches[0] };
    }
    return { ambiguous: partialMatches };
  }

  if (candidates && candidates.length > 0) {
    const choiceIdx = parseDisambiguationChoice(inputText, candidates.length);
    if (choiceIdx !== null && searchPool[choiceIdx]) {
      return { match: searchPool[choiceIdx] };
    }
  }

  return { match: null };
}

function parseDisambiguationChoice(inputText, count) {
  const normalized = normalizeText(inputText).trim();
  const digitMatch = normalized.match(/^(\d+)$/);
  if (digitMatch) {
    const idx = parseInt(digitMatch[1], 10) - 1;
    if (idx >= 0 && idx < count) return idx;
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  const ordinalWords = [
    ["first", "1st", "one", "unang", "uno"],
    ["second", "2nd", "two", "pangalawa", "dos"],
    ["third", "3rd", "three", "pangatlo", "tres"],
  ];
  for (let i = 0; i < Math.min(ordinalWords.length, count); i++) {
    if (words.some((w) => ordinalWords[i].includes(w))) return i;
  }
  return null;
}

function buildDisambiguationPrompt(candidates, labelFn) {
  const lines = candidates
    .map((item, i) => `${i + 1}. ${labelFn(item)}`)
    .join("\n");
  return `I found multiple matches. Which one?\n${lines}\n\nReply with the number (e.g. 1 or 2).`;
}

const MONTH_NAME_TO_NUMBER = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
  april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

function detectRecurrenceFromText(text = "") {
  const raw = String(text || "").toLowerCase();
  if (!raw) return null;
  if (/\bevery\s+week\b|\bweekly\b|\b kada linggo\b/.test(raw)) return "weekly";
  if (/\bevery\s+year\b|\byearly\b|\bannually\b/.test(raw)) return "yearly";
  if (/\bevery\b|\bmonthly\b|\b kada buwan\b/.test(raw)) return "monthly";
  return null;
}

function nextCalendarDay(dayOfMonth) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let candidate = new Date(year, month, dayOfMonth);
  candidate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (candidate < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = new Date(year, month, dayOfMonth);
  }
  if (candidate.getDate() !== dayOfMonth) return null;
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
}

function parseDueDate(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const ordinalDay = raw.match(/\b(?:every\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (ordinalDay) {
    const day = parseInt(ordinalDay[1], 10);
    if (day >= 1 && day <= 31) {
      const next = nextCalendarDay(day);
      if (next) return next;
    }
  }

  const defaultYear = new Date().getFullYear();
  for (const [name, monthNum] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    const patterns = [
      new RegExp(`\\b${name}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, "i"),
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${name}(?:,?\\s*(\\d{4}))?\\b`, "i"),
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (!m) continue;
      const day = parseInt(m[1], 10);
      const year = m[2] ? parseInt(m[2], 10) : defaultYear;
      if (day >= 1 && day <= 31) {
        const candidate = new Date(year, monthNum - 1, day);
        if (candidate.getMonth() === monthNum - 1 && candidate.getDate() === day) {
          return `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }

  return null;
}

function extractDueDateFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const duePhrase = raw.match(/\bdue\s+(.+?)(?:\s+every|\s+monthly|$)/i);
  if (duePhrase) {
    const parsed = parseDueDate(duePhrase[1].trim());
    if (parsed) return parsed;
  }
  return parseDueDate(raw);
}

function financeTipFromStats(stats = {}) {
  const expensesStore = useExpensesStore();
  const walletsStore = useWalletsStore();

  const expenses = parseFloat(stats.monthly_expenses || 0);
  const left = walletsStore.totalBalance;
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
  const reason = sanitizeExpenseReason(
    extractExpenseReason(text, walletsStore.wallets),
  );
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


  if (shouldFetchFromServer()) {
    dashboardStore.fetchStats().catch(() => { });
  }

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
    walletType: isLending ? "lending" : resolveWalletIconType(payload.wallet),
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
async function _executeDeposit(amount, wallet, salaryStore, dashboardStore, sourceText = "") {
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
    walletType: resolveWalletIconType(wallet, sourceText),
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
  const normalizedType = resolveWalletIconType({ type: walletType, name: walletName });
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
    type: normalizedType,
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
    walletType: normalizedType,
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

  const walletType = resolveWalletIconType({
    type: detectedType || inferWalletType(walletName),
    name: walletName,
  });
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
      walletType: resolveWalletIconType(wallet),
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
    normalized.includes("last week") ||
    normalized.includes("nakaraang linggo")
  ) {
    range = "last_week";
  } else if (
    normalized.includes("this week") ||
    normalized.includes("ngayong linggo")
  ) {
    range = "week";
  } else if (
    normalized.includes("last month") ||
    normalized.includes("nakaraang buwan")
  ) {
    range = "last_month";
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
    let usedExact = false;

    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const tmStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const tmEndStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        
        const lmStartStr = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
        const lmEndStr = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [resTm, resLm] = await Promise.all([
          api.get('/dashboard/stats', { params: { start_date: tmStartStr, end_date: tmEndStr } }),
          api.get('/dashboard/stats', { params: { start_date: lmStartStr, end_date: lmEndStr } })
        ]);

        if (resTm?.data?.data && resLm?.data?.data) {
          thisMonthTotal = parseFloat(resTm.data.data.monthly_expenses || 0);
          lastMonthTotal = parseFloat(resLm.data.data.monthly_expenses || 0);
          usedExact = true;
        }
      } catch (e) {
        // Silently fallback to local paginated calculation
      }
    }

    if (!usedExact) {
      for (const expense of expensesStore.expenses) {
        const d = parseExpenseDate(expense);
        if (!d) continue;
        if (d >= thisMonthStart) {
          thisMonthTotal += parseFloat(expense.amount || 0);
        } else if (d >= lastMonthStart && d < thisMonthStart) {
          lastMonthTotal += parseFloat(expense.amount || 0);
        }
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
  } else if (range === "last_week") {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    filtered = filtered.filter((e) => {
      const d = new Date(e.date || e.created_at);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });
  } else if (range === "week") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    filtered = filtered.filter(
      (e) => new Date(e.date || e.created_at) >= sevenDaysAgo,
    );
  } else if (range === "last_month") {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = filtered.filter((e) => {
      const d = new Date(e.date || e.created_at);
      return d >= startOfLastMonth && d < startOfThisMonth;
    });
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
        : range === "last_week"
          ? "last week"
          : range === "week"
            ? "this week"
            : range === "last_month"
              ? "last month"
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
        walletType: wallet ? resolveWalletIconType(wallet) : null,
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
      walletType: wallet ? resolveWalletIconType(wallet) : null,
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
        walletType: wallet ? resolveWalletIconType(wallet) : null,
      };
    }

    const lines = ranked
      .map(([key, amount], index) => `${index + 1}. ${CATEGORY_LABELS[key] || getCategoryLabel(key) || key}: ${formatMoney(amount)}`)
      .join("\n");

    return {
      ok: true,
      message: `Top spending categories ${range === "month" ? "this month" : rangeLabel}:\n${lines}`,
      kind: "query",
      walletType: wallet ? resolveWalletIconType(wallet) : null,
    };
  }

  // ── 8. Compute total ──────────────────────────────────────────────────
  let total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  // If asking for a general total over a time period, the local paginated data is incomplete.
  // Fetch the exact sum from the backend if online.
  if (typeof window !== "undefined" && navigator.onLine) {
    if (!queryCategory && !asksLatest && !asksOverspending) {
      let startDateStr = null;
      let endDateStr = null;

      if (range === "month") {
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        endDateStr = new Date(y, m, 0).toISOString().slice(0, 10);
      } else if (range === "last_month") {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        startDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
        endDateStr = new Date(y, m, 0).toISOString().slice(0, 10);
      } else if (range === "last_week") {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(now.getDate() - 14);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        startDateStr = fourteenDaysAgo.toISOString().slice(0, 10);
        
        // Match the < sevenDaysAgo logic used in the filter
        const sixDaysAgo = new Date(sevenDaysAgo);
        sixDaysAgo.setDate(sevenDaysAgo.getDate() - 1);
        endDateStr = sixDaysAgo.toISOString().slice(0, 10);
      } else if (range === "week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        startDateStr = sevenDaysAgo.toISOString().slice(0, 10);
        endDateStr = todayStr;
      }

      if (startDateStr && endDateStr) {
        try {
          const res = await api.get('/dashboard/stats', { 
            params: { start_date: startDateStr, end_date: endDateStr } 
          });
          if (res?.data?.data) {
            total = res.data.data.monthly_expenses;
          }
        } catch (e) {
          // Fallback to local sum
        }
      }
    }
  }

  // ── 9. Build human-readable labels ────────────────────────────────────

  // ── 10. Build response ────────────────────────────────────────────────
  // Case A: Category-specific query with zero results
  if (queryCategory && filtered.length === 0) {
    return {
      ok: true,
      message: `No ${queryCategory.label} expenses found ${rangeLabel}${walletLabel}. Either you haven't logged any yet, or you've been really good about it!`,
      kind: "query",
      walletType: wallet ? resolveWalletIconType(wallet) : null,
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
      walletType: wallet ? resolveWalletIconType(wallet) : null,
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
    walletType: wallet ? resolveWalletIconType(wallet) : null,
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

  const aggregateDebts = (debtsArray) => {
    const grouped = new Map();
    for (const d of debtsArray) {
      const normalizedName = d.name.trim().toLowerCase();
      if (!grouped.has(normalizedName)) {
        grouped.set(normalizedName, { name: d.name.trim(), amount: parseFloat(d.amount || 0) });
      } else {
        grouped.get(normalizedName).amount += parseFloat(d.amount || 0);
      }
    }
    return Array.from(grouped.values());
  };

  if (showOwedToMe) {
    if (owedToMe.length > 0) {
      message += `OWED TO YOU\n`;
      message += aggregateDebts(owedToMe)
        .map((d) => `• ${d.name}: ${formatMoney(d.amount)}`)
        .join("\n");
    } else if (isAskingOwedByOthers) {
      message += `There are no outstanding debts owed to you at this time.`;
    }
  }

  if (showIOwe && showOwedToMe && message && iOwe.length > 0) message += "\n\n";

  if (showIOwe) {
    if (iOwe.length > 0) {
      message += `YOU OWE\n`;
      message += aggregateDebts(iOwe)
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

  const walletsStore = useWalletsStore();
  const left = walletsStore.totalBalance;
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
    const data = {
      from_wallet_id: fromWallet.id,
      to_wallet_id: toWallet.id,
      amount: amount,
      date: new Date().toISOString().split('T')[0],
      description: `Transfer from ${fromWallet.name || fromWallet.type} to ${toWallet.name || toWallet.type}`,
    };
    
    if (navigator.onLine) {
      await transferService.create(data);
    } else {
      await outboxAdd({
        method: "post",
        url: "/transfers",
        data,
        entity: "transfers",
        tempId: `tmp_${crypto.randomUUID()}`
      });
      await refreshPendingCount();
    }

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

  if (mappedIntent === "pay_plan") {
    const walletsStore = useWalletsStore();
    if (!entities.amount) entities.amount = extractAmount(text);
    if (!entities.wallet) {
      entities.wallet = matchWallet(text, walletsStore.wallets);
    }
    const result = await dispatchPayPlan(text, sessionId, entities);
    return result ? { ...result, intentType: "action" } : null;
  }

  if (mappedIntent === "pay_debt") {
    const result = await dispatchPayDebt(text, sessionId, entities);
    return result ? { ...result, intentType: "action" } : null;
  }

  if (mappedIntent === "create_plan") {
    if (!entities.amount) entities.amount = extractAmount(text);
    if (!entities.date) entities.date = extractDueDateFromText(text);
    if (!entities.recurrence) entities.recurrence = detectRecurrenceFromText(text);
    if (!entities.reason && !isBarePlanTrigger(text)) {
      const walletsStore = useWalletsStore();
      const inferredReason = sanitizePlanReason(
        extractExpenseReason(text, walletsStore.wallets),
        text,
      );
      if (inferredReason) entities.reason = inferredReason;
    }
    const result = await planAction("create_plan", entities, sessionId, text);
    return result ? { ...result, intentType: "action" } : null;
  }

  if (mappedIntent === "view_plans") {
    const plansStore = usePlansStore();
    const result = await _executeViewPlans(plansStore);
    return result ? { ...result, intentType: "query" } : null;
  }

  // ── ACTION INTENTS: route through deliberative orchestrator ───────────────
  const actionIntents = [
    "log_expense",
    "deposit",
    "create_debt_i_owe",
    "create_debt_owed_to_me",
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
    if (!entities.reason) {
      entities.reason = sanitizeExpenseReason(
        extractExpenseReason(text, walletsStore.wallets),
      );
    }
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
  if (intent === "pay_plan") return "plan payment";
  if (intent === "create_plan") return "upcoming payment";
  if (intent === "view_plans") return "upcoming plans";
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
  if (aiData.reason) {
    aiEntities.reason =
      aiData.action === "log_expense"
        ? sanitizeExpenseReason(aiData.reason)
        : aiData.action === "create_plan"
          ? sanitizePlanReason(aiData.reason, text)
          : aiData.reason;
  }

  // Match wallet names to actual wallet objects
  // Prevent AI hallucination by verifying the wallet was actually mentioned in the text
  const textWalletMatch = matchWallet(text, walletsStore.wallets);
  if (textWalletMatch) {
    aiEntities.wallet = textWalletMatch;
    aiEntities.walletName = textWalletMatch.name;
    aiEntities.walletId = textWalletMatch.id;
  } else if (aiData.wallet_name) {
    // Only fallback to AI's extraction if we couldn't find it locally, but AI explicitly found one
    // We check if the AI extracted name is actually in the text (case-insensitive) to prevent hallucinating "Cash"
    if (normalizeText(text).includes(normalizeText(aiData.wallet_name))) {
      aiEntities.wallet = matchWallet(aiData.wallet_name, walletsStore.wallets);
      if (aiEntities.wallet) {
        aiEntities.walletName = aiEntities.wallet.name;
        aiEntities.walletId = aiEntities.wallet.id;
      }
    }
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
  if (aiData.date) aiEntities.date = aiData.date;

  if (aiData.wallet_name && !aiEntities.wallet) {
    const fromName = matchWallet(aiData.wallet_name, walletsStore.wallets);
    if (fromName) {
      aiEntities.wallet = fromName;
      aiEntities.walletId = fromName.id;
    }
  }

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
  history = []
) {
  let text = String(message || "").trim();
  if (!text) {
    return { ok: false, message: "Please type a finance question or command." };
  }

  const requiresFull = _requiresFullSentenceFlags.get(sessionId) === true;
  if (requiresFull) {
    const normalized = normalizeText(text);
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      return {
        ok: false,
        message: "Please type a complete sentence, e.g. 'I spent 500 using cash for food'",
        kind: "text",
        intentType: "query",
      };
    } else {
      _requiresFullSentenceFlags.delete(sessionId);
    }
  }

  await ensureLoaded();

  if (pendingAction) {
    const pendingResolved = await resolvePendingAction(text, sessionId);
    if (pendingResolved) {
      return {
        ...pendingResolved,
        intentType: pendingResolved.intentType || "action",
      };
    }
  }

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
      const reminderStr = getPendingReminder(existingCtx);
      return {
        ok: true,
        message: getSmallTalkReply(pendingSmallTalk, getLastBotAction()),
        reminder: reminderStr ? reminderStr : null,
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
      incomingIntentName !== "ambiguous" &&
      incomingIntentName !== "out_of_scope";

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
      "forget it",
      "ayaw na lang",
      "dili na",
      "stop",
      "scratch that"
    ].some((w) => normalizeText(text).includes(w));

    if (isCancelWord) {
      deletePendingContext(sessionId);
      return {
        ok: true,
        message: "Okay, cancelled! Let me know if you need anything.",
        kind: "text",
        intentType: "query",
      };
    }

    let aiIncomingIntent = null;
    let aiData = null;
    let aiProvider = null;

    let isLikelySlotFilling = false;
    let currentSlotField = null;
    let missing = [];

    if (existingCtx && REQUIRED_FIELDS[existingCtx.intent]) {
      const required = getRequiredFields(existingCtx.intent, existingCtx.entities);
      missing = required.filter(field => {
        const val = existingCtx.entities[field];
        if (val === null || val === undefined) return true;
        if (typeof val === "string" && val.trim() === "") return true;
        if (existingCtx.intent === "log_expense" && field === "category" && val === "expense" && !existingCtx.entities.reason) {
          return true;
        }
        return false;
      });
      currentSlotField = missing[0];

      if (currentSlotField) {
        const looksLikeQuestion = /^(what|how|where|who|when|why|show|list|can you|help)\b/i.test(normalizeText(text));
        const walletsStore = useWalletsStore();
        const textHasAmount = extractAmount(text) !== null;
        const textHasWallet = matchWallet(text, walletsStore.wallets) !== null;
        const textHasCategory = detectCategory(text) !== "expense";
        const textHasPerson = extractPersonName(text) !== null;

        if (currentSlotField === "amount" && textHasAmount) {
          isLikelySlotFilling = true;
        } else if (
          (currentSlotField === "wallet" || currentSlotField === "walletId" || currentSlotField === "fromWallet" || currentSlotField === "toWallet") &&
          textHasWallet
        ) {
          isLikelySlotFilling = true;
        } else if (currentSlotField === "category") {
          const isCategoryWord = textHasCategory;
          const isReasonAnswer = text.trim().length >= 3 &&
                                 !/^\d+$/.test(text.trim()) &&
                                 !looksLikeQuestion &&
                                 !textHasAmount;
          if (isCategoryWord || isReasonAnswer) {
            isLikelySlotFilling = true;
          }
        } else if (currentSlotField === "person") {
          const isPersonName = textHasPerson;
          const isNameAnswer = text.trim().length >= 2 &&
                               !/^\d+$/.test(text.trim()) &&
                               !looksLikeQuestion &&
                               !textHasAmount;
          if (isPersonName || isNameAnswer) {
            isLikelySlotFilling = true;
          }
        } else if (currentSlotField === "debtId") {
          const debtsStore = useDebtsStore();
          const debtsResult = findDebtByName(text, debtsStore.debts);
          if (debtsResult.match || debtsResult.ambiguous || (text.trim().length >= 2 && !/^\d+$/.test(text.trim()) && !looksLikeQuestion && !textHasAmount)) {
            isLikelySlotFilling = true;
          }
        } else if (
          !["amount", "wallet", "walletId", "fromWallet", "toWallet", "category", "person", "debtId"].includes(currentSlotField) &&
          text.trim().length > 0
        ) {
          isLikelySlotFilling = true;
        }
      }
    }

    // create_wallet uses walletName/walletType on ctx — not REQUIRED_FIELDS.entities
    if (existingCtx.intent === "create_wallet") {
      const normalizedWalletReply = normalizeText(text);
      const zeroWords = [
        "none",
        "empty",
        "wala",
        "zero",
        "nothing",
        "blank",
        "walang laman",
      ];
      if (
        extractAmount(text) !== null ||
        normalizedWalletReply === "0" ||
        zeroWords.some((w) => normalizedWalletReply.includes(w))
      ) {
        isLikelySlotFilling = true;
      }
    }

    const actionKeywords = [
      "spend", "spent", "deposit", "transfer", "balance", "owe", "lend", 
      "pay", "limit", "budget", "income", "salary", "payroll", 
      "cashout", "cashin", "cash in", "cash out", "bayad", "utang", "padala",
      "pila", "check", "magkano", "pera", "cash", "wallet"
    ];
    const textHasActionKeyword = actionKeywords.some(w => normalizeText(text).includes(w));
    const textHasAmount = extractAmount(text) !== null;
    const isPotentialNewIntent = isLocalNewIntent || textHasAmount || textHasActionKeyword;

    if (!isLocalNewIntent && !isLikelySlotFilling && isPotentialNewIntent) {
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

    const resolvedIntentName = (incomingIntentName && incomingIntentName !== "unknown" && incomingIntentName !== "ambiguous")
      ? incomingIntentName
      : aiIncomingIntent;
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
      const mappedIncomingIntent = _mapNluIntent(resolvedIntentName, incomingNlu.entities || aiData || {});
      const incomingIntentType = getIntentType(mappedIncomingIntent);
      const isActionInterruption = incomingIntentType === "action";

      if (isActionInterruption) {
        deletePendingContext(sessionId);
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
        const finalIntentName = aiIncomingIntent || incomingIntentName;
        const finalIntentType = getIntentType(
          _mapNluIntent(finalIntentName, incomingNlu.entities || aiData || {})
        );
        
        let finalMessage = result.message;
        let reminderStr = null;
        
        if (!isActionInterruption && existingCtx) {
          const reminder = getPendingReminder(existingCtx);
          if (reminder) {
            reminderStr = reminder;
          }
        }

        return {
          ...result,
          message: finalMessage,
          reminder: reminderStr,
          intentType: finalIntentType,
        };
      }
    }

    // If it is not a new intent and it's not likely slot filling, then it is an invalid slot answer!
    if (!isLikelySlotFilling && existingCtx.intent !== "create_wallet") {
      existingCtx.retryCount = (existingCtx.retryCount || 0) + 1;
      if (existingCtx.retryCount >= 2) {
        deletePendingContext(sessionId);
        _requiresFullSentenceFlags.set(sessionId, true);
        return {
          ok: false,
          message: "I wasn't able to understand. Please try again with a complete sentence.",
          kind: "query",
          intentType: "query",
        };
      }

      setPendingContext(sessionId, existingCtx);

      let promptMsg = "";
      if (
        currentSlotField === "wallet" ||
        currentSlotField === "walletId" ||
        currentSlotField === "fromWallet" ||
        currentSlotField === "toWallet"
      ) {
        promptMsg = "Sorry, I didn't catch that. Which wallet did you use? (e.g. GCash, Maya, BPI, cash)";
      } else if (currentSlotField === "category") {
        promptMsg = "Sorry, I didn't get that. What is it for? (e.g. food, transport, bills)";
      } else if (currentSlotField === "person") {
        promptMsg = "Sorry, I didn't catch the person's name. Who is it?";
      } else if (currentSlotField === "amount") {
        promptMsg = "Sorry, I didn't get that amount. How much did you spend?";
      } else if (existingCtx.intent === "create_wallet") {
        promptMsg = `Sorry, I didn't quite catch the amount. How much is the starting balance for your ${existingCtx.walletName}? Just type a number like "500" or "0" if it's empty right now.`;
      } else {
        promptMsg = `Sorry, I didn't catch that. ${askForMissingField(currentSlotField, existingCtx)}`;
      }

      return {
        ok: true,
        message: promptMsg,
        kind: "question",
        intentType: "action",
      };
    }

    // If it's a valid slot filling input, reset retryCount for the next field
    existingCtx.retryCount = 0;

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
  let isActionIntent = intentType === "action";

  let isConfidentAndComplete = false;
  if (nluResult.matched && nluResult.intent !== "unknown" && nluResult.intent !== "ambiguous" && nluResult.intent !== "out_of_scope") {
    if (isActionIntent) {
      const orchestratorIntent = mappedIntentForType.startsWith("create_debt") ? "create_debt" : mappedIntentForType;
      const required = getRequiredFields(orchestratorIntent, nluResult.entities);
      const missing = required.filter(field => {
        const val = nluResult.entities?.[field];
        if (val === null || val === undefined) return true;
        if (typeof val === "string" && val.trim() === "") return true;
        if (
          orchestratorIntent === "log_expense" &&
          field === "category" &&
          val === "expense" &&
          !nluResult.entities?.reason
        ) {
          return true;
        }
        return false;
      });

      if (nluResult.confidence >= 0.95) {
        isConfidentAndComplete = true;
      }
    }
  }

  // 1. If it is confident and complete (ACTION ONLY), execute it locally!
  if (isConfidentAndComplete) {
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
      // EXCEPTION: query intents that require smart logic should fall through to the conversational AI
      const AI_QUERY_INTENTS = new Set(["query_expenses", "query_debts", "query_budget", "query_balance"]);
      if (aiData.action && aiData.action !== "reply") {
        if (AI_QUERY_INTENTS.has(aiData.action)) {
          // The AI correctly classified this as a query, overriding any potential local misclassification
          isActionIntent = false;
        } else {
          const result = await executeAiAction(aiData, interpretResponse.data.provider, text, sessionId);
          if (result) return result;
        }
      }

      // If AI returned a reply (not an action), show it as text
      if (aiData.action === "reply" && aiData.message) {
        return {
          ok: true,
          message: normalizeHelpReply(aiData.message),
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

  // Fall back to conversational AI if it is not a matched action intent
  if (!isActionIntent) {
    try {
      const dashboardStore = useDashboardStore();
      const customBudget = getMonthlyBudgetLimit();
      const response = await api.post("/chat/message", {
        message: text,
        history: history.slice(-10), // Limit to last 10 messages to avoid token bloat
        stats: {
          monthly_income: parseFloat(dashboardStore.stats.monthly_income || 0),
          monthly_expenses: parseFloat(dashboardStore.stats.monthly_expenses || 0),
          remaining_salary: useWalletsStore().totalBalance,
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

async function _executeCreatePlan(title, amount, dateStr, recurrence, plansStore, dashboardStore) {
  if (!plansStore.fetched) await plansStore.fetchAll();
  await plansStore.create({
    title,
    amount,
    due_date: dateStr,
    category: "bills",
    description: "Added via EleFam chat",
    recurrence: recurrence || null,
  });
  dashboardStore.fetchStats().catch(() => {});
  return {
    ok: true,
    message: `Successfully created plan ${title} for ${formatMoney(amount)}.`,
    kind: "action",
  };
}

function isAffirmativeReply(text) {
  const n = normalizeText(text);
  return ["yes", "y", "oo", "oo po", "sige", "confirm", "confirmed", "okay", "ok", "proceed", "go ahead", "tama", "correct"].some(
    (w) => n === w || n.startsWith(`${w} `) || n.startsWith(`${w},`),
  );
}

function isNegativeReply(text) {
  const n = normalizeText(text);
  return ["no", "nope", "cancel", "wag", "wag na", "huwag", "ayaw", "stop", "nevermind", "never mind"].some(
    (w) => n === w || n.startsWith(`${w} `),
  );
}

function isSkipReply(text) {
  const n = normalizeText(text);
  return ["skip", "no date", "same date", "keep date", "none", "wala"].some((w) => n === w || n.includes(w));
}

function formatPlanDueDate(dateStr) {
  if (!dateStr) return "the current due date";
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function finalizePlanPayment(plan, payAmount, wallet, isPartial, newDueDate, sessionId) {
  const plansStore = usePlansStore();
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();

  await plansStore.markPaid(plan.id, wallet.id, payAmount, isPartial, newDueDate, {
    expense_description: "Paid via Marti AI",
  });
  await plansStore.fetchFeed({ limit: 15 });
  await walletsStore.fetchAll(true);
  dashboardStore.fetchStats().catch(() => {});

  const updated = plansStore.plans.find((p) => String(p.id) === String(plan.id));
  const remainder = isPartial
    ? Math.max(0, parseFloat(updated?.amount ?? 0))
    : 0;

  if (!isPartial) {
    notifyFinanceActivity({ entity: "plan", action: "paid", planId: plan.id });
    return {
      ok: true,
      message: `Successfully paid ${formatMoney(payAmount)} for ${plan.title} from your ${wallet.name}. It’s marked PAID on your Plans page.`,
      kind: "action",
    };
  }

  return {
    ok: true,
    message: `Paid ${formatMoney(payAmount)} toward ${plan.title} from ${wallet.name}. Remaining balance: ${formatMoney(remainder)} (due ${formatPlanDueDate(newDueDate || updated?.due_date || plan.due_date)}).`,
    kind: "action",
  };
}

async function executePayPlan(planOrNull, amount, wallet, sessionId, reasonFallback = "") {
  const plansStore = usePlansStore();
  const walletsStore = useWalletsStore();

  if (!plansStore.fetched) await plansStore.fetchAll(true);

  let plan = planOrNull;
  if (!plan && reasonFallback) {
    const unpaid = plansStore.plans.filter((p) => !p.is_paid);
    const found = findPlanByName(reasonFallback, unpaid);
    plan = found.match;
  }

  if (!plan) {
    return {
      ok: false,
      message: `I couldn't find an active plan${reasonFallback ? ` named "${reasonFallback}"` : ""}.`,
      kind: "query",
    };
  }

  if (!wallet) {
    return planAction(
      "pay_plan",
      { reason: plan.title, amount, wallet: null, _resolvedPlan: plan },
      sessionId,
      "",
    );
  }

  const planAmount = parseFloat(plan.amount);
  let payAmount = amount ? parseFloat(amount) : planAmount;
  if (isNaN(payAmount) || payAmount <= 0) payAmount = planAmount;
  const isPartial = payAmount + 0.009 < planAmount;

  if (Number(wallet.balance) < payAmount) {
    return {
      ok: false,
      message: `Not enough balance in ${wallet.name} to pay ${formatMoney(payAmount)}. You only have ${formatMoney(wallet.balance)} left.`,
      kind: "query",
    };
  }

  if (isPartial) {
    const dueLabel = formatPlanDueDate(plan.due_date);
    const today = new Date().toISOString().slice(0, 10);
    const isDueToday = plan.due_date === today;
    
    pendingAction = {
      type: "confirm_partial_plan",
      sessionId,
      plan,
      payAmount,
      wallet,
      isDueToday
    };
    
    if (isDueToday) {
      return {
        ok: false,
        message: `This is a partial payment of ${formatMoney(payAmount)} toward ${plan.title}. ${formatMoney(planAmount - payAmount)} will remain. Since it's due today, you can optionally set a new due date for the balance. Reply "yes" to confirm (and keep today as due date), "yes [new date]" to extend it, or "no" to cancel.`,
        kind: "question",
        intentType: "action",
      };
    } else {
      return {
        ok: false,
        message: `This is a partial payment of ${formatMoney(payAmount)} toward ${plan.title}. ${formatMoney(planAmount - payAmount)} will remain due on ${dueLabel}. Reply "yes" to confirm or "no" to cancel.`,
        kind: "question",
        intentType: "action",
      };
    }
  }

  return finalizePlanPayment(plan, payAmount, wallet, false, null, sessionId);
}

async function executePayDebt(debtId, amount, walletId, sessionId) {
  const debtsStore = useDebtsStore();
  const walletsStore = useWalletsStore();
  const dashboardStore = useDashboardStore();
  return _executePayDebt(
    debtId,
    amount,
    walletId,
    debtsStore,
    walletsStore,
    dashboardStore,
  );
}

async function dispatchPayPlan(text, sessionId, entities = {}) {
  const plansStore = usePlansStore();
  const walletsStore = useWalletsStore();

  if (!plansStore.fetched) await plansStore.fetchAll(true);
  const unpaid = plansStore.plans.filter((p) => !p.is_paid);

  if (!entities.amount) entities.amount = extractAmount(text);
  if (!entities.wallet) {
    entities.wallet = matchWallet(text, walletsStore.wallets);
  }

  let planResult = { match: null };
  if (entities._resolvedPlan) {
    planResult = { match: entities._resolvedPlan };
  } else if (entities.reason) {
    planResult = findPlanByName(entities.reason, unpaid);
    if (!planResult.match && !planResult.ambiguous) {
      planResult = findPlanByName(text, unpaid);
    }
  } else {
    planResult = findPlanByName(text, unpaid);
  }

  if (planResult.ambiguous) {
    pendingAction = {
      type: "pay_plan",
      candidates: planResult.ambiguous,
      entities: {
        amount: entities.amount,
        wallet: entities.wallet,
      },
      sessionId,
    };
    return {
      ok: false,
      message: buildDisambiguationPrompt(
        planResult.ambiguous,
        (p) => `${p.title} (${formatMoney(p.amount)})`,
      ),
      kind: "question",
      intentType: "action",
    };
  }

  if (!planResult.match) {
    if (!entities.reason) {
      return planAction("pay_plan", entities, sessionId, text);
    }
    return {
      ok: false,
      message: `I couldn't find an active plan matching "${entities.reason}".`,
      kind: "query",
    };
  }

  const plan = planResult.match;
  entities.reason = plan.title;
  entities._resolvedPlan = plan;
  if (!entities.amount || entities.amount <= 0) {
    entities.amount = parseFloat(plan.amount);
  }

  if (!entities.wallet) {
    return planAction("pay_plan", entities, sessionId, text);
  }

  return executePayPlan(plan, entities.amount, entities.wallet, sessionId, plan.title);
}

async function dispatchPayDebt(text, sessionId, entities = {}) {
  const debtsStore = useDebtsStore();
  const walletsStore = useWalletsStore();

  if (debtsStore.debts.length === 0) await debtsStore.fetchAll();

  if (!entities.amount) entities.amount = extractAmount(text);
  if (!entities.walletId) {
    const matched = matchWallet(text, walletsStore.wallets);
    if (matched) entities.walletId = matched.id;
  }

  if (!entities.debtId) {
    let searchPool = debtsStore.debts;
    if (entities.type) {
      searchPool = searchPool.filter((d) => d.type === entities.type);
    }
    const debtsResult = findDebtByName(text, searchPool);
    if (debtsResult.match) {
      entities.debtId = debtsResult.match.id;
    } else if (debtsResult.ambiguous) {
      pendingAction = {
        type: "pay_debt",
        candidates: debtsResult.ambiguous,
        entities: {
          amount: entities.amount,
          walletId: entities.walletId,
          type: entities.type,
        },
        sessionId,
      };
      return {
        ok: false,
        message: buildDisambiguationPrompt(
          debtsResult.ambiguous,
          (d) => `${d.name} (${formatMoney(d.amount)})`,
        ),
        kind: "question",
        intentType: "action",
      };
    }
  }

  if (!entities.debtId || entities.amount == null || entities.amount === undefined || !entities.walletId) {
    return planAction("pay_debt", entities, sessionId, text);
  }

  return executePayDebt(entities.debtId, entities.amount, entities.walletId, sessionId);
}

async function resolveConfirmPartialPlan(text, sessionId) {
  const action = pendingAction;
  if (isNegativeReply(text)) {
    pendingAction = null;
    return {
      ok: true,
      message: "Okay, cancelled the partial payment.",
      kind: "text",
      intentType: "action",
    };
  }

  let newDueDate = null;
  const stripped = text.replace(/^\s*(yes|oo|sige|ok|okay|confirm)[,\s]*/i, "").trim();
  if (stripped) {
    newDueDate = parseDueDate(stripped) || extractDueDateFromText(stripped);
  }

  if (!isAffirmativeReply(text) && !newDueDate) {
    return {
      ok: false,
      message: `Please reply yes to confirm the partial payment of ${formatMoney(action.payAmount)}.`,
      kind: "question",
      intentType: "action",
    };
  }

  pendingAction = null;
  return finalizePlanPayment(
    action.plan,
    action.payAmount,
    action.wallet,
    true,
    newDueDate,
    sessionId,
  );
}

async function resolvePlanRescheduleDue(text, sessionId) {
  const action = pendingAction;

  if (isSkipReply(text)) {
    pendingAction = null;
    return {
      ok: true,
      message: `Got it. The remaining ${formatMoney(action.remainder)} for ${action.planTitle} stays due ${formatPlanDueDate(action.dueHint)}.`,
      kind: "text",
      intentType: "action",
    };
  }

  const newDate = parseDueDate(text) || extractDueDateFromText(text);
  if (!newDate) {
    return {
      ok: false,
      message: `Please send a due date (e.g. "July 15") or say "skip".`,
      kind: "question",
      intentType: "action",
    };
  }

  pendingAction = null;
  const plansStore = usePlansStore();
  const plan = plansStore.plans.find((p) => String(p.id) === String(action.planId));
  if (!plan) {
    return {
      ok: false,
      message: "I couldn't find that plan to update the due date.",
      kind: "query",
    };
  }
  try {
    await plansStore.update(action.planId, {
      title: plan.title,
      amount: plan.amount,
      due_date: newDate,
      description: plan.description ?? null,
      recurrence: plan.recurrence || null,
    });
    return {
      ok: true,
      message: `Updated the remaining balance due date for ${action.planTitle} to ${formatPlanDueDate(newDate)}.`,
      kind: "action",
    };
  } catch {
    return {
      ok: false,
      message: "I couldn't update the due date. You can change it from the Plans page.",
      kind: "query",
    };
  }
}

async function resolvePendingAction(text, sessionId = "default") {
  if (!pendingAction || pendingAction.sessionId !== sessionId) {
    return null;
  }

  if (pendingAction.type === "confirm_partial_plan") {
    return resolveConfirmPartialPlan(text, sessionId);
  }

  if (pendingAction.type === "plan_reschedule_due") {
    return resolvePlanRescheduleDue(text, sessionId);
  }

  const candidates = pendingAction.candidates;
  if (!candidates?.length) {
    pendingAction = null;
    return null;
  }

  const choiceIdx = parseDisambiguationChoice(text, candidates.length);
  if (choiceIdx === null) {
    pendingAction = null;
    return null;
  }

  const action = pendingAction;
  pendingAction = null;
  const selected = action.candidates[choiceIdx];
  const { amount, wallet, walletId, type } = action.entities;

  if (action.type === "pay_plan") {
    const walletsStore = useWalletsStore();
    const resolvedWallet =
      wallet || (walletId ? walletsStore.wallets.find((w) => String(w.id) === String(walletId)) : null);
    const payAmount =
      amount && amount > 0 ? amount : parseFloat(selected.amount);
    if (!resolvedWallet) {
      return planAction(
        "pay_plan",
        {
          reason: selected.title,
          amount: payAmount,
          wallet: null,
          _resolvedPlan: selected,
        },
        sessionId,
        text,
      );
    }
    return executePayPlan(selected, payAmount, resolvedWallet, sessionId, selected.title);
  }

  if (action.type === "pay_debt") {
    const payAmount =
      amount && amount > 0 ? amount : Math.abs(parseFloat(selected.amount || 0));
    if (!walletId) {
      return planAction(
        "pay_debt",
        { debtId: selected.id, amount: payAmount, walletId: null, type },
        sessionId,
        text,
      );
    }
    return executePayDebt(selected.id, payAmount, walletId, sessionId);
  }

  return null;
}

function _executeViewPlans(plansStore) {
  return new Promise(async (resolve) => {
    if (!plansStore.fetched) await plansStore.fetchAll();
    const activePlans = plansStore.plans.filter(p => !p.is_paid);
    
    if (activePlans.length === 0) {
      return resolve({ ok: true, message: "You don't have any upcoming plans right now.", kind: "query" });
    }
    
    const lines = activePlans.map(p => `• ${p.title}: ${formatMoney(p.amount)} (due ${new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`).join("\n");
    resolve({
      ok: true,
      message: `You have ${activePlans.length} upcoming plans:\n\n${lines}`,
      kind: "query"
    });
  });
}

if (typeof window !== 'undefined') {
  window.processEleFamMessage = processEleFamMessage;
  window.clearPendingContext = clearPendingContext;
  window.getPendingContext = getPendingContext;
  window.clearPendingAction = clearPendingAction;
}

