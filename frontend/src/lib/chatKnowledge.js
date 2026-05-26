import { normalizeText } from "@/lib/chatIntents.js";

let _lastBotAction = null;

export function setLastBotAction(action) {
  _lastBotAction = action;
}

export function getLastBotAction() {
  return _lastBotAction;
}

export function clearLastBotAction() {
  _lastBotAction = null;
}

const FLOW_KNOWLEDGE = [
  {
    topic: "general_onboarding",
    aliases: [
      "how to use this app",
      "how to use the app",
      "how do i start tracking my money here",
      "can you help me understand how to use this app",
      "where do i start",
      "how to begin",
      "how to start",
      "walk me through",
      "guide me through",
      "tutorial",
      "instructions",
      "features of this app",
      "what does this app do",
      "how does this work",
      "paano gamitin ito",
      "unsaon paggami ani",
      "help me get started",
      "get started"
    ],
    answer: [
      "Welcome to EleFam. I am Marti, your personal finance assistant. Here is how to get started:",
      "",
      "1. Add Wallets: Track cash, GCash, Maya, or bank accounts (e.g. 'new wallet GCash 5000').",
      "2. Log Expenses: Track what you spend (e.g. 'spent 150 food from GCash').",
      "3. Deposit Income: Record salary or cash-ins (e.g. 'deposit 25000 to bank').",
      "4. Transfer Money: Move money between wallets (e.g. 'transfer 1000 from bank to GCash').",
      "5. Track Debts: Track who owes you or who you owe (e.g. 'Mark owes me 400' or 'i owe Ana 800').",
      "6. Set Budgets: Keep your monthly spending in check (e.g. 'set my budget to 15000').",
      "",
      "You can ask me questions about your balances (e.g. 'how much money do I have?') or recent expenses (e.g. 'what did I spend on food?').",
      "",
      "How can I assist you with your finances today?"
    ].join("\n"),
  },
  {
    topic: "add_wallet",
    aliases: [
      "add wallet",
      "create wallet",
      "new wallet",
      "how to add wallet",
      "how do i add wallet",
      "how can i add wallet",
      "how i add wallet",
      "how to make wallet",
      "i want add wallet",
      "can you add wallet",
      "wallet add please",
      "need to add wallet",
      "need add wallet",
      "i need wallet",
      "please add wallet",
      "want create wallet",
      "open new wallet",
      "paano mag add wallet",
      "paano gumawa wallet",
      "gawa wallet",
      "bagong wallet",
      "himo wallet",
      "unsaon pag add wallet",
      "unsaon paghimo wallet",
      "i wanna add wallet",
      "i would like to add wallet",
      "help me add wallet",
      "can i make a wallet",
      "making a wallet",
      "setup wallet",
      "wallet setup",
      "need new wallet",
      "create new wallet",
      "add a new wallet",
      "make a wallet",
      "wallet creation",
      "how do i create wallet",
      "guide me to add wallet",
      "i need to create wallet",
      "want to setup wallet",
      "wallet please",
      "add my wallet",
      "gagawa ako wallet",
      "magkakaroon ako wallet",
      "kailangan ko wallet",
      "maglagay ng wallet",
      "ilagay wallet",
      "baguhin wallet",
    ],
    answer: [
      "To add a wallet in Elefam:",
      '1) Type: "new wallet <wallet name> <starting balance>"',
      '2) Example: "new wallet Travel Fund 1000"',
      "3) If you skip the amount, I will ask for it next.",
      "4) You can also add common wallets like GCash, Maya, BPI, BDO, and more.",
    ].join("\n"),
  },
  {
    topic: "deposit",
    aliases: [
      "deposit",
      "how to deposit",
      "how do i deposit",
      "add money",
      "top up",
      "cash in",
      "how can i deposit",
      "how i deposit money",
      "i want deposit money",
      "put money to wallet",
      "i need deposit",
      "can you help deposit",
      "need to deposit",
      "need deposit now",
      "add funds please",
      "put cash to wallet",
      "paano mag deposit",
      "paano maghulog",
      "magdagdag pera",
      "dugang kwarta",
      "sulod kwarta",
      "unsaon pag deposit",
      "i wanna deposit",
      "i would like to deposit",
      "help me deposit",
      "can i deposit money",
      "depositing money",
      "money deposit",
      "add cash",
      "need to add money",
      "put money in",
      "insert money",
      "fund my wallet",
      "wallet funding",
      "how do i add funds",
      "guide me to deposit",
      "i need to deposit",
      "want to add funds",
      "deposit please",
      "deposit my money",
      "my deposit",
      "own deposit",
      "personal deposit",
      "magdeposit ako",
      "maghuhulog ako",
      "kailangan ko magdeposit",
      "maglagay ng pera",
      "ilagay pera",
      "dagdagan pera",
    ],
    answer: [
      "To deposit money:",
      '1) Type: "deposit <amount> to <wallet>"',
      '2) Example: "deposit 2000 to maya"',
      "3) If amount or wallet is missing, I will ask follow-up questions.",
    ].join("\n"),
  },
  {
    topic: "transfer",
    aliases: [
      "transfer",
      "how to transfer",
      "how do i transfer",
      "move money",
      "send money",
      "how can i transfer",
      "how i transfer money",
      "help transfer money",
      "move money to wallet",
      "send money from wallet",
      "need transfer money",
      "need to transfer",
      "can i transfer now",
      "move funds please",
      "shift money wallet",
      "paano mag transfer",
      "ilipat pera",
      "balhin kwarta",
      "unsaon pag transfer",
      "i wanna transfer",
      "i would like to transfer",
      "help me transfer",
      "can i move money",
      "moving money",
      "money transfer",
      "send funds",
      "need to move money",
      "shift funds",
      "transfer funds",
      "move my money",
      "wallet transfer",
      "how do i send money",
      "guide me to transfer",
      "i need to transfer",
      "want to move funds",
      "transfer please",
      "transfer my money",
      "my transfer",
      "own transfer",
      "personal transfer",
      "magttransfer ako",
      "maglilipat ako pera",
      "kailangan ko magtransfer",
      "maglipat ng pera",
      "ilipat pera",
      "ibalhin pera",
    ],
    answer: [
      "To transfer between wallets:",
      '1) Type: "transfer <amount> from <source wallet> to <destination wallet>"',
      '2) Example: "transfer 500 from gcash to maya"',
      "3) If details are incomplete, I will guide you step by step.",
    ].join("\n"),
  },
  {
    topic: "log_expense",
    aliases: [
      "log expense",
      "add expense",
      "record expense",
      "how to add expense",
      "how do i log expense",
      "how can i log expense",
      "how i add my expense",
      "help me log expense",
      "i want track expense",
      "where i put my expenses",
      "need to log expense",
      "need expense record",
      "track my gastos",
      "record my spending",
      "spent",
      "gastos",
      "paano mag log ng gastos",
      "unsaon pag log expense",
      "i wanna log expense",
      "i would like to log expense",
      "help me add expense",
      "can i add expense",
      "adding expense",
      "expense logging",
      "track spending",
      "need to record expense",
      "put expense",
      "log my spending",
      "expense tracker",
      "how do i record expense",
      "guide me to log expense",
      "i need to log expense",
      "want to track expense",
      "expense please",
      "log my expense",
      "my expense",
      "own expense",
      "personal expense",
      "maglo-log ako ng gastos",
      "magrerecord ako gastos",
      "kailangan ko mag-log gastos",
      "mag-log ng gastos",
      "irecord gastos",
      "it trak gastos",
    ],
    answer: [
      "To log an expense:",
      '1) Type: "spent <amount> <reason> from <wallet>"',
      '2) Example: "spent 350 food from gcash"',
      "3) You can also ask by category later (food, bills, transport, etc.).",
    ].join("\n"),
  },
  {
    topic: "debt",
    aliases: [
      "debt",
      "utang",
      "how to add debt",
      "how to pay debt",
      "how do i track utang",
      "how can i track debt",
      "how i can pay utang",
      "how to record i owe",
      "how to record owes me",
      "help me with debt",
      "need to pay debt",
      "need debt tracking",
      "record my utang",
      "manage my debt",
      "i owe",
      "owes me",
      "paano mag utang record",
      "unsaon pag track utang",
      "i wanna track debt",
      "i would like to track debt",
      "help me with utang",
      "can i add debt",
      "adding debt",
      "debt tracking",
      "track utang",
      "need to record debt",
      "put debt",
      "log my debt",
      "debt manager",
      "how do i record debt",
      "guide me to track debt",
      "i need to track debt",
      "want to manage debt",
      "debt please",
      "track my debt",
      "my debt",
      "own debt",
      "personal debt",
      "magttrack ako ng utang",
      "magrerecord ako utang",
      "kailangan ko mag-track utang",
      "mag-track ng utang",
      "irecord utang",
      "it trak utang",
    ],
    answer: [
      "To track debts:",
      '• You owe someone: "i owe Ana 800"',
      '• Someone owes you: "Mark owes me 400"',
      '• Pay debt: "pay Ana 300 from gcash" or "pay Ana" to settle full amount.',
    ].join("\n"),
  },
  {
    topic: "budget",
    aliases: [
      "budget",
      "how to check budget",
      "how to set budget",
      "remaining budget",
      "how can i check budget",
      "how i set budget",
      "how to budget in app",
      "help budget",
      "can i set monthly budget",
      "need check budget",
      "need set budget",
      "show budget status",
      "left budget please",
      "paano check budget",
      "paano set budget",
      "natitirang budget",
      "unsaon pagtanaw budget",
      "i wanna check budget",
      "i would like to check budget",
      "help me with budget",
      "can i set budget",
      "setting budget",
      "budget planning",
      "check my budget",
      "need to see budget",
      "show budget",
      "view budget",
      "budget checker",
      "how do i check budget",
      "guide me to budget",
      "i need to check budget",
      "want to set budget",
      "budget please",
      "check my budget",
      "my budget",
      "own budget",
      "personal budget",
      "chekin ako ng budget",
      "magse-set ako budget",
      "kailangan ko mag-check budget",
      "mag-check ng budget",
      "iset budget",
      "tanawin budget",
    ],
    answer: [
      "For budget in Elefam:",
      '• Check: ask "budget left"',
      '• Set monthly limit: "set my budget to 12000"',
      '• Undo latest budget change: "undo budget"',
    ].join("\n"),
  },
  {
    topic: "missing_wallets",
    aliases: [
      "what wallet i dont have",
      "what wallets i dont have",
      "wallet i dont have",
      "wallets i dont have",
      "missing wallet",
      "missing wallets",
      "what wallet missing",
      "which wallet missing",
      "wallet i do not have",
      "wallets i do not have",
      "what wallet do i not have",
      "which wallet do i not have",
      "wallet i lack",
      "wallets i lack",
      "what wallet i lack",
      "which wallet i lack",
      "other wallet",
      "other wallets",
      "available wallets",
      "available wallet",
      "show available wallets",
      "list available wallets",
      "what wallets can i add",
      "which wallets can i add",
      "wallets available to add",
      "available wallet types",
      "what wallet types available",
      "anong wallet wala",
      "ano pang wallet wala",
      "wallet na wala sakin",
      "wallets na wala sakin",
      "unsa pa wallet wala nako",
      "wallet nga wala nako",
      "unsa pa nga wallet",
      "anong available na wallet",
      "unsa available nga wallet",
      "total wallets",
    ],
    answer: [
      "To see which wallets you don't have yet, you can ask:",
      '• "what wallet i dont have"',
      '• "available wallets"',
      '• "list available wallets"',
      '• "what wallets can i add"',
      "",
      "I will show you all wallet types and mark which ones you already have.",
    ].join("\n"),
  },
];

const TECHNICAL_QUESTION_HINTS = [
  "tech stack",
  "stack",
  "framework",
  "frontend",
  "backend",
  "database",
  "tidb",
  "supabase",
  "vue",
  "react",
  "laravel",
  "api",
  "endpoint",
  "schema",
  "sql",
  "code",
  "source code",
  "architecture",
  "infra",
  "deployment",
  "server",
  "hosting",
  "version",
  "dependency",
];

const SMALLTALK_RESPONSES = {
  greeting: [
    "Hi! I'm Marti. I can guide you with wallets, deposits, transfers, expenses, debts, and budget flows.",
    "Hello! I'm here to help you use this app's finance features like wallet setup, deposits, transfers, and expense tracking.",
    "Hey! Tell me your goal and I'll guide you step by step.",
    "Hi there. What would you like to do today? I can help with wallets, money transfers, expenses, debts, or budget planning.",
    "Hello. Ready to manage your finances? Just tell me what you need and I'll walk you through it.",
    "Hey. I'm Marti, your finance assistant. Ask me anything about wallets, deposits, transfers, expenses, debts, or budget.",
    "Hi. How can I help you with your money today? Wallets, deposits, transfers, expenses, debts, or budget — just ask.",
  ],
  thanks: [
    "You're welcome! If you want, ask me how to add wallet, deposit, transfer, or track expenses.",
    "Happy to help. You can also ask me for step-by-step finance flows.",
    "Anytime. I can keep guiding you one step at a time.",
    "Glad I could help. Let me know if you need anything else with your finances.",
    "You're welcome! I'm here whenever you need assistance.",
    "My pleasure. Feel free to ask more questions about wallets, transfers, or budgeting.",
    "No problem at all. I'm happy to guide you through any finance flow here.",
    "You got it. Reach out if you need to log anything else.",
    "Don't mention it! I'm always here to crunch the numbers for you.",
  ],
  confused: [
    "No worries, I got you. Tell me what you want to do: add wallet, deposit, transfer, log expense, debt, or budget.",
    "I can guide you step by step. Start with one goal: wallet, deposit, transfer, expense, debt, or budget.",
    "I understand. Let me help you — what do you want to accomplish? I can help with wallets, money transfers, expenses, debts, or budget.",
    "Sorry about that. Can you tell me more about what you're trying to do? I can help with adding wallets, depositing money, transferring funds, logging expenses, tracking debts, or checking your budget.",
    "I'm here to help. Just describe what you need in simple words, and I'll guide you through it.",
    'No problem. Try saying things like "add wallet", "deposit money", "transfer funds", "log expense", "track debt", or "check budget".',
    "It's okay to be stuck! I'm designed to help you with things like checking balances, logging expenses, or setting budgets. Which of those sounds good?",
  ],
  reassure: [
    "I am not lying, promise. I just need the missing details to continue correctly.",
    "I am sure. I am guiding you step by step so we avoid wrong transactions.",
    "I understand. I am here to help, and I only need a bit more info to proceed.",
    "You are safe with me. I only ask missing details so your transaction is correct.",
    "I promise I'm being honest with you. I just want to make sure we get this right.",
    "Trust me — I'm here to help you correctly. A few more details and we're done.",
    "I'm not fooling you. I need to ask some questions to avoid mistakes.",
    "You can rely on me. I'll guide you carefully so everything goes smoothly.",
    "I double-checked my circuits, and I'm positive!",
    "Absolutely. I take your finances very seriously.",
  ],
  angry: [
    "I hear your frustration, and I want to fix this with you. Let us do it step by step.",
    "You are right to call that out. I will keep this simple and help you finish the task now.",
    "Thanks for being direct. I am here to help, and we can complete this in a few clear steps.",
    "I understand this is frustrating. I will stay focused and guide you to the correct action.",
    "I'm sorry for the trouble. Let's fix this together — what do you need help with?",
    "I get that this is annoying. I'll do my best to help you quickly and clearly.",
    "Your frustration is valid. Let me help you get this done right now.",
    "I hear you. Let's take it one step at a time and get this resolved.",
    "I apologize for the confusion. Let's start over — what are you trying to do?",
  ],
  cancel: [
    "Understood. If there is an active finance action, treat it as cancelled. Tell me what you want to do next.",
    "Okay, cancel noted. You can now start a new request like add wallet, deposit, transfer, expense, debt, or budget.",
    "Got it — cancelled. What would you like to do instead?",
    "No problem, I've cancelled that. Let me know what you need help with next.",
    "Alright, stopping that action. What's your next step?",
    "Cancelled. We can move on to something else whenever you're ready.",
  ],
  bye: [
    "Anytime. I'm here when you need help with your finance flows.",
    "Sure, see you. Message me again for wallet, deposit, transfer, or expense help.",
    "Take care. Come back anytime you need help with your finances.",
    "Goodbye. I'm here whenever you need assistance.",
    "See you later. Feel free to reach out for any finance-related questions.",
    "Bye for now. Keep an eye on those expenses.",
    "Have a great day. I'll be right here when you need to check your budget.",
  ],
  unknown: [
    "I'm not sure I understood that. Could you tell me what you're trying to do? I can help with wallets, deposits, transfers, expenses, debts, or budget.",
    "Hmm, I didn't quite catch that. Can you rephrase it? I can guide you through adding wallets, depositing money, transferring funds, logging expenses, tracking debts, or checking your budget.",
    'I\'m still learning! Try saying something like "add wallet", "deposit money", "transfer funds", "log expense", "track debt", or "check budget".',
    "I want to help, but I need a bit more context. What are you trying to accomplish today?",
    'Let me help you better. Describe what you want in simple words — like "I want to add a wallet" or "I need to deposit money".',
    "I might have gotten a bit lost there. Want to try asking that another way?",
  ],
  identity: [
    "I'm Marti, your personal finance assistant. I can help you manage wallets, deposits, transfers, expenses, debts, and budget. Just tell me what you need.",
    "I'm Marti. I help you track money in and out — wallets, deposits, transfers, expenses, debts, and monthly budgets.",
    "My name is Marti. I'm a finance assistant built into this app, and I can guide you through wallet setup, money deposits, transfers, expense logging, debt tracking, and budget planning.",
    "Yes, I'm an AI assistant focused on your finances in this app. Ask me to log an expense, check your balance, or set your budget.",
    "I'm Marti, your finance bot. I keep things practical, respectful, and focused on helping you manage money better.",
  ],
  capabilities: [
    "Here's what I can do for you:\n• Add and manage wallets (GCash, Maya, BPI, BDO, etc.)\n• Deposit money to wallets\n• Transfer money between wallets\n• Log expenses with categories\n• Track debts (who owes who)\n• Set and check monthly budget\n\nJust tell me what you need!",
    "I can help you with:\n• Wallet management — add, view, check balance\n• Deposits — add money to any wallet\n• Transfers — move money between wallets\n• Expenses — log and track spending\n• Debts — record and pay off debts\n• Budget — set limits and check status\n\nTry asking me something.",
    "My main features revolve around keeping your finances in check. I can log your expenses, tell you your wallet balances, track who owes you money, and watch your monthly budget.",
  ],
  affirmative: [
    "Great. What would you like to do? I can help with wallets, deposits, transfers, expenses, debts, or budget.",
    "Alright. Tell me what you need — add wallet, deposit, transfer, log expense, track debt, or check budget.",
    "Sure thing. What's your next step?",
    "Got it. How can I help you?",
    "Awesome. Let's get to it. What do you want to track?",
  ],
  negative: [
    "No problem. Let me know if you change your mind or need help with anything else.",
    "Okay, that's fine. I'm here whenever you're ready.",
    "Alright. Just message me when you need help with wallets, deposits, transfers, expenses, debts, or budget.",
    "Understood. Take your time, and reach out when you need to log something.",
  ],
  acknowledge: [
    "Got it. Is there anything else you'd like to do? I can help with wallets, deposits, transfers, expenses, debts, or budget.",
    "Alright. Let me know if you need anything else.",
    "Noted. What's next?",
    "I see. Need help with anything else here?",
    "Makes sense. What else is on your mind regarding your finances?",
  ],
  casual: [
    "Haha. Anyway, how can I help you today? Wallets, deposits, transfers, expenses, debts, or budget — just ask.",
    "Nice. So, what would you like to do? I'm ready to help with any finance flow here.",
    "Cool. Let me know if you need help with anything — wallets, money, expenses, debts, or budget.",
    "That's interesting! But speaking of interesting things, want to check your budget?",
    "I see. Let's get back to business though—need me to log any expenses for you?",
  ],
  command_start: [
    "Yes!",
    "Certainly.",
    "Sure thing!",
    "Absolutely!",
    "Got it.",
    "Alright.",
    "No problem!",
    "Sure.",
    "Of course.",
    "Awesome!",
    "Right away.",
    "Okay!"
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// NLU ENGINE — Negation-aware semantic matching with disambiguation
// ═══════════════════════════════════════════════════════════════════════════════

const NEGATION_WORDS = new Set([
  "not",
  "no",
  "dont",
  "do not",
  "doesnt",
  "does not",
  "didnt",
  "did not",
  "cant",
  "cannot",
  "can not",
  "wont",
  "will not",
  "never",
  "neither",
  "nor",
  "without",
  "lack",
  "lacking",
  "missing",
  "wala",
  "hindi",
  "walang",
  "dili",
  "walay",
]);

const POSITIVE_POSSESSION = new Set([
  "have",
  "has",
  "own",
  "got",
  "hold",
  "holding",
  "meron",
  "mayroon",
  "naa",
  "aduna",
  "existing",
  "current",
  "present",
]);

const NEGATIVE_POSSESSION = new Set([
  "dont have",
  "do not have",
  "doesnt have",
  "does not have",
  "not have",
  "lacking",
  "missing",
  "without",
  "lack",
  "wala",
  "walang",
  "hindi meron",
  "walay",
  "wala nako",
  "wala ko",
]);

function hasNegation(normalized) {
  for (const neg of NEGATIVE_POSSESSION) {
    if (normalized.includes(neg)) return true;
  }
  const words = normalized.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (NEGATION_WORDS.has(words[i])) {
      for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
        if (POSITIVE_POSSESSION.has(words[j])) return true;
      }
    }
  }
  return false;
}

function hasPositivePossession(normalized) {
  if (hasNegation(normalized)) return false;
  const words = normalized.split(/\s+/);
  return words.some((w) => POSITIVE_POSSESSION.has(w));
}

// Semantic intent patterns — structured matching for common question types
// Each pattern: { test: fn(normalized) => bool, intent: string, score: number }
const SEMANTIC_PATTERNS = [
  // Expanded Semantic patterns
  {
    test: (n) =>
      /(is that all|is that it|right\?|tama ba|sure ka|correct|mao ba|diba|meaning).*(balance|total|wallet)/.test(
        n,
      ),
    intent: "reassure",
    score: 250,
  },
  {
    test: (n) =>
      /wall(et|ets)/.test(n) && hasPositivePossession(n) && !hasNegation(n),
    intent: "query_balance",
    score: 200,
  },
  {
    test: (n) => /wall(et|ets)/.test(n) && hasNegation(n),
    intent: "query_missing_wallets",
    score: 200,
  },
  {
    test: (n) =>
      /(can you help me|could you help me|can you assist me|please assist me|need your help|i need your help)/.test(
        n,
      ) && !/wall|depos|transfer|expens|debt|budget/.test(n),
    intent: "ask_help",
    score: 170,
  },
  {
    test: (n) =>
      /(walk me through|guide me through|walk me|guide me).*(finance|finances|money|app|system|this)/.test(
        n,
      ),
    intent: "ask_help",
    score: 180,
  },
  {
    test: (n) =>
      /^(can you help|help me|please help|i need help)/.test(n) &&
      !/wall|depos|transfer|expens|debt|budget/.test(n),
    intent: "ask_help",
    score: 150,
  },
  {
    test: (n) =>
      /(how much|magkano|pila).*(spend|spent|gastos|expense)/.test(n),
    intent: "query_expenses",
    score: 200,
  },
  {
    test: (n) =>
      /(how much|magkano|pila).*(balance|wallet|money|pera|kwarta)/.test(n),
    intent: "query_balance",
    score: 200,
  },
  {
    test: (n) => /(show|list|display|view).*(expense|spending|gastos)/.test(n),
    intent: "query_expenses",
    score: 180,
  },
  {
    test: (n) => /(show|list|display|view).*(wallet|balance)/.test(n),
    intent: "query_balance",
    score: 180,
  },
  {
    test: (n) => /(show|list|display|view).*(debt|utang|owe)/.test(n),
    intent: "query_debts",
    score: 180,
  },
  {
    test: (n) => /(add|create|new|gawa|himo).*(wallet|account)/.test(n),
    intent: "create_wallet",
    score: 180,
  },
  {
    test: (n) =>
      /(add|deposit|cash in|pasok).*(money|cash|pera|kwarta)/.test(n),
    intent: "deposit",
    score: 180,
  },
  {
    test: (n) => /(transfer|move|send).*(money|funds|pera|kwarta)/.test(n),
    intent: "transfer",
    score: 180,
  },
  {
    test: (n) =>
      /(record|track|log).*(spending|expense|what i spent|my spend)/.test(n),
    intent: "log_expense",
    score: 180,
  },
];

export function matchSemanticPattern(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const pattern of SEMANTIC_PATTERNS) {
    if (pattern.test(normalized)) return pattern;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL INFERENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
const CONTEXTUAL_INFERENCE_PATTERNS = [
  {
    test: (n) =>
      /(dropped|forked out|shelled out|splurged|spent).*(cash|money|pera|kwarta)/.test(
        n,
      ),
    intent: "log_expense",
    score: 260,
  },
  {
    test: (n) =>
      /(forked out|fork out|shelled out|shell out|blew|blow|blew through|blow through|spent|spend).*(\d+|\d+(\.\d+)?k|\d+(\.\d+)?m).*(for|on|at)/.test(
        n,
      ),
    intent: "log_expense",
    score: 260,
  },
  {
    test: (n) =>
      /(blew|blow|blew through|blow through|spent|spend).*(money|cash|pera|kwarta|budget)/.test(
        n,
      ),
    intent: "log_expense",
    score: 255,
  },
  {
    test: (n) => /(paid for|bought|purchase|purchased).*(for|on|at)/.test(n),
    intent: "log_expense",
    score: 240,
  },
  {
    test: (n) =>
      /(loaded|top(ped)? up|cash in|added funds|put money in).*(wallet|gcash|maya|account)/.test(
        n,
      ),
    intent: "deposit",
    score: 240,
  },
  {
    test: (n) =>
      /(moved|shifted).*(money|funds).*(between|from).*(wallet|account)/.test(n),
    intent: "transfer",
    score: 240,
  },
  // "i think i need to see my wallet" / "let me see wallet"
  {
    test: (n) =>
      /(need to see|let me see|want to see|can i see|view|check|show).*(wallet|balance|money|pera)/.test(
        n,
      ),
    intent: "query_balance",
    score: 250,
  },
  // "how about my expenses" / "what about gastos" / "show me my food expenses"
  {
    test: (n) =>
      /(how about|what about|ano naman|unsa naman|show me|see my|check my).*(expense|gastos|spending)/.test(
        n,
      ),
    intent: "query_expenses",
    score: 250,
  },
  // "i want to pay my debt"
  {
    test: (n) =>
      /(want to pay|need to pay|let me pay|bayaran|bayri).*(debt|utang)/.test(
        n,
      ),
    intent: "pay_debt",
    score: 250,
  },
  // "i borrowed money"
  {
    test: (n) =>
      /(borrowed|borrow|hiram|utang).*(money|cash|pera)/.test(n) &&
      (n.includes("i") || n.includes("ako") || n.includes("ko")),
    intent: "create_debt_i_owe",
    score: 250,
  },
  // "someone borrowed from me"
  {
    test: (n) =>
      /(borrowed|borrow|utang|hiram).*(from me|sakin|sa ako)/.test(n),
    intent: "create_debt_owed_to_me",
    score: 250,
  },
  // "who owes me money"
  {
    test: (n) => /(who owes me|sino may utang)/.test(n),
    intent: "query_debts",
    score: 250,
  },
  // "who do i owe"
  {
    test: (n) => /(who do i owe|sino utang ko)/.test(n),
    intent: "query_debts",
    score: 250,
  },
];

export function matchContextualInference(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const pattern of CONTEXTUAL_INFERENCE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { intent: pattern.intent, score: pattern.score };
    }
  }
  return null;
}

const FLOW_TOPIC_KEYWORDS = {
  add_wallet: ["wallet", "create", "add", "new", "open"],
  deposit: ["deposit", "top", "cash", "add", "funds", "money"],
  transfer: ["transfer", "move", "send", "wallet"],
  log_expense: ["expense", "spent", "spend", "gastos", "record", "log"],
  debt: ["debt", "utang", "owe", "owed", "pay"],
  budget: ["budget", "remaining", "left", "set", "monthly"],
  missing_wallets: ["wallet", "missing", "lack", "available", "dont have"],
};

const LIGHT_STOP_WORDS = new Set([
  "i",
  "me",
  "my",
  "you",
  "your",
  "the",
  "a",
  "an",
  "to",
  "for",
  "of",
  "in",
  "on",
  "and",
  "or",
  "can",
  "could",
  "would",
  "should",
  "please",
  "need",
  "want",
  "help",
  "how",
  "what",
  "is",
  "are",
  "do",
  "does",
  "did",
  "am",
  "here",
  "this",
  "app",
  "use",
  "start",
  "understand",
  "about",
  "begin",
  "get",
]);

function scoreAliasMatch(normalizedText, alias) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return 0;
  if (normalizedText.includes(normalizedAlias))
    return normalizedAlias.length + 100;

  const aliasWords = normalizedAlias
    .split(" ")
    .filter(Boolean)
    .filter((w) => !LIGHT_STOP_WORDS.has(w));
  if (!aliasWords.length) return 0;
  const matchedCount = aliasWords.filter((word) =>
    normalizedText.includes(word),
  ).length;
  if (!matchedCount) return 0;
  return matchedCount * 10;
}

function scoreKeywordBagMatch(normalizedText, topic = "") {
  const keywords = FLOW_TOPIC_KEYWORDS[topic] || [];
  if (!keywords.length) return 0;

  const words = normalizedText
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !LIGHT_STOP_WORDS.has(w));

  if (!words.length) return 0;

  const matched = keywords.filter((kw) =>
    words.some((w) => w.includes(kw) || kw.includes(w)),
  ).length;
  if (!matched) return 0;
  return matched * 8;
}

export function getFlowKnowledgeMatch(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const cancelOrStopWords = [
    "cancel",
    "stop",
    "never mind",
    "nevermind",
    "abort",
    "terminate",
    "ayaw na",
    "wag na",
    "huwag na",
  ];
  if (cancelOrStopWords.some((w) => normalized.includes(w))) return null;

  // Negation-aware guard: if user says "wallet i have" (positive), skip missing_wallets
  const isNeg = hasNegation(normalized);
  const isPos = hasPositivePossession(normalized);

  let best = null;
  for (const entry of FLOW_KNOWLEDGE) {
    // Guard: skip missing_wallets if sentence is positive possession
    if (entry.topic === "missing_wallets" && isPos && !isNeg) continue;
    // Guard: skip add_wallet if sentence is a query (has "have"/"got" without "add"/"create"/"new")
    if (entry.topic === "add_wallet" && (isPos || isNeg)) {
      const hasActionWord = [
        "add",
        "create",
        "new",
        "make",
        "setup",
        "open",
        "gawa",
        "himo",
      ].some((w) => normalized.includes(w));
      if (!hasActionWord) continue;
    }

    let bestScore = 0;
    for (const alias of entry.aliases) {
      bestScore = Math.max(bestScore, scoreAliasMatch(normalized, alias));
    }
    bestScore += scoreKeywordBagMatch(normalized, entry.topic);
    if (!best || bestScore > best.score) {
      best = { entry, score: bestScore };
    }
  }

  if (!best || best.score < 20) return null;
  return best.entry;
}

export function isTechnicalQuestion(text = "") {
  const normalized = normalizeText(text);
  return TECHNICAL_QUESTION_HINTS.some((hint) => normalized.includes(hint));
}

// FIXED: word boundary matcher for short words to prevent false-positive
// substring matches (e.g., 'hi' inside 'think', 'hey' inside 'they')
function _matchesWord(normalized, word) {
  if (word.length <= 3) {
    return new RegExp(`\\b${word}\\b`).test(normalized);
  }
  return normalized.includes(word);
}

// FIXED: finance keywords that should suppress greeting detection.
// If a message contains these, it's a finance query — not just a greeting.
const _FINANCE_INTENT_SIGNALS = [
  "wallet",
  "wallets",
  "balance",
  "deposit",
  "transfer",
  "expense",
  "spent",
  "spend",
  "debt",
  "utang",
  "budget",
  "gastos",
  "pera",
  "kwarta",
  "money",
  "owe",
  "lent",
  "bayad",
  "salary",
  "income",
  "ipon",
  "save",
  "savings",
];

function _hasFinanceSignal(normalized) {
  return _FINANCE_INTENT_SIGNALS.some((w) => normalized.includes(w));
}

export function detectSmallTalk(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;

  const greetingHints = [
    "hello",
    "hi",
    "hey",
    "elefam",
    "good morning",
    "good afternoon",
    "good evening",
    "kumusta",
    "kamusta",
    "musta",
    "yo",
    "sup",
    "good day",
    "greetings",
    "hi there",
    "hey there",
    "uy",
    "oi",
    "hoy",
    "hellow",
    "helo",
    "henlo",
    "howdy",
    "hiya",
    "how are you",
    "hows it going",
    "whats up",
    "what is up",
    "good to see you",
    "hey bot",
    "morning",
    "afternoon",
    "evening",
    "hello elefam",
    "marti",
    "hello marti",
    "hi marti",
    "hey marti",
  ];
  const thanksHints = [
    "thanks",
    "thank you",
    "salamat",
    "ty",
    "tnx",
    "thx",
    "thank",
    "thank u",
    "thnk u",
    "tysm",
    "tyvm",
    "appreciate it",
    "much appreciated",
    "thanks a lot",
    "thank you so much",
    "maraming salamat",
    "daghang salamat",
    "cheers",
    "you rock",
    "that helped",
    "good job",
    "great job",
    "well done",
    "thanks for the help",
    "awesome thanks",
    "perfect thanks",
    "thankyou",
    "thankyou so much",
  ];
  const confusedHints = [
    "i dont understand",
    "i do not understand",
    "im confused",
    "confuse",
    "help me please",
    "please help me",
    "not clear",
    "unclear",
    "di ko gets",
    "i dont get it",
    "what do you mean",
    "explain more",
    "clarify",
    "huh",
    "say again",
    "repeat",
    "come again",
    "di ko maintindihan",
    "di ko kasabot",
    "lost",
    "im lost",
    "i am lost",
    "how does this work",
    "what do i do now",
    "i dont know what to do",
    "stuck",
    "im stuck",
    "can you explain",
  ];
  const reassureHints = [
    "are you sure",
    "you sure",
    "are you lying",
    "you lying",
    "not lying",
    "seryoso ka",
    "sigurado ka",
    "for real",
    "seriously",
    "you certain",
    "is this correct",
    "is this right",
    "you promise",
    "trust you",
    "can i trust you",
    "legit ba",
    "totoo ba",
    "is this accurate",
    "is it accurate",
    "are you accurate",
    "accurate ba",
    "tama ba ito",
    "tama ba",
    "sure ba",
    "are you positive",
    "you positive",
    "is this safe",
    "is it safe",
    "can i count on you",
    "is this real",
  ];
  const angryHints = [
    "stupid",
    "useless",
    "dumb",
    "wtf",
    "annoying",
    "angry",
    "frustrated",
    "nakakainis",
    "bwisit",
    "gago",
    "tanga",
    "hate this",
    "this sucks",
    "terrible",
    "worst",
    "why cant you",
    "why not working",
    "fix this",
    "broken",
    "bobo",
    "inutil",
    "amp",
    "putangina",
    "leche",
    "buset",
    "this is bullshit",
    "you are annoying",
    "terrible bot",
    "bad bot",
    "i hate this",
    "this app is terrible",
    "stop it",
    "idiot",
    "crap",
    "bullshit",
  ];
  const cancelHints = [
    "cancel",
    "cancel it",
    "cancel transaction",
    "stop this",
    "nevermind",
    "never mind",
    "abort",
    "ayaw na",
    "wag na",
    "huwag na",
    "forget it",
    "dont do it",
    "no more",
    "stop",
    "i changed my mind",
    "changed mind",
    "wait stop",
    "hold on stop",
    "nvm",
  ];
  const byeHints = [
    "bye",
    "goodbye",
    "see you",
    "paalam",
    "sige bye",
    "see ya",
    "later",
    "got to go",
    "leaving",
    "exit",
    "quit",
    "good night",
    "gnight",
    "take care",
    "ingat",
    "babay",
    "catch you later",
    "talk to you later",
    "peace out",
    "im out",
  ];
  const identityHints = [
    "who are you",
    "what are you",
    "whats your name",
    "what is your name",
    "introduce yourself",
    "sino ka",
    "anong pangalan mo",
    "kinsa ka",
    "tell me about yourself",
    "are you a bot",
    "are you a robot",
    "are you ai",
    "are you an ai",
    "are you an ai assistant",
    "ai assistant",
    "are you an assistant",
    "are you assistant",
    "are you real",
    "are you human",
    "are you chatgpt",
    "who made you",
    "who created you",
    "are you alive",
    "do you have feelings",
    "what kind of bot are you",
    "are you marti",
    "who is marti",
    "whos marti",
  ];
  const capabilityHints = [
    "what can you do",
    "what do you do",
    "what are your features",
    "what features",
    "how can you help",
    "how do you work",
    "how does this work",
    "what is this app",
    "what is elefam",
    "what is this",
    "ano magagawa mo",
    "ano features",
    "unsa imong mahimo",
    "ano kaya mo",
    "what else can you do",
    "can you give me advice",
    "what are your limits",
    "what can i ask you",
    "list your features",
    "help me understand you",
    "can you assist me",
    "please assist me",
    "help me use this",
  ];
  const affirmativeExact = new Set([
    "yes",
    "yeah",
    "yep",
    "yup",
    "sure",
    "ok",
    "okay",
    "alright",
    "correct",
    "oo",
    "opo",
    "sige",
    "go",
    "g",
    "ge",
    "oki",
    "okii",
    "oo naman",
    "sige na",
    "exactly",
    "absolutely",
    "definitely",
    "of course",
    "indeed",
    "totally",
  ]);
  const affirmativeContains = [
    "lets go",
    "proceed",
    "continue",
    "go ahead",
    "do it",
    "make it so",
    "sounds good",
    "looks good",
    "that works",
    "do that",
    "that good",
    "thats good",
    "that's good",
    "yes good",
    "very good",
    "so good",
    "nice",
    "great",
    "awesome",
    "perfect",
    "excellent",
  ];
  const negativeExact = new Set([
    "no",
    "nope",
    "nah",
    "hindi",
    "ayaw",
    "dili",
    "not really",
    "never",
    "wrong",
    "incorrect",
  ]);
  const negativeContains = [
    "no thanks",
    "not now",
    "not yet",
    "maybe later",
    "later na",
    "mamaya na",
    "wag muna",
    "hindi muna",
    "next time",
    "dont think so",
    "not quite",
  ];
  const acknowledgeHints = [
    "oh",
    "ohh",
    "ohhh",
    "ah",
    "ahh",
    "i see",
    "okay got it",
    "gotcha",
    "understood",
    "noted",
    "makes sense",
    "ahhh",
    "ooh",
    "gets",
    "gets na",
    "ah ganun",
    "ganun pala",
    "ah ok",
    "oh ok",
    "sabi mo",
    "aha",
    "alrighty",
    "roger that",
    "fair enough",
    "good to know",
    "interesting",
  ];
  const casualHints = [
    "lol",
    "lmao",
    "haha",
    "hehe",
    "hihi",
    "nice",
    "cool",
    "great",
    "awesome",
    "wow",
    "omg",
    "oh my god",
    "damn",
    "dang",
    "whoa",
    "yay",
    "galing",
    "grabe",
    "grabee",
    "shet",
    "hay",
    "ayos",
    "thats crazy",
    "no way",
    "amazing",
    "whatever you say",
    "okay then",
    "bruh",
    "wow that is cool",
    "nice one",
    "that good",
    "thats good",
    "that's good",
    "yes good",
    "very good",
    "so good",
    "perfect",
    "excellent",
  ];
  const unknownHints = [
    "idk",
    "whatever",
    "random",
    "test",
    "testing",
    "hello world",
    "blah",
    "asdf",
    "qwer",
    "just checking",
    "checking",
    "trial",
    "aaa",
    "zzz",
    "xxx",
    "hmm",
    "hmmm",
    "idk anymore",
    "not sure",
    "who knows",
    "well then",
  ];
  const timeHints = [
    "what time is it",
    "what is the time",
    "current time",
    "anong oras na",
    "unsa nang orasa",
    "time is it",
  ];

  if (thanksHints.some((w) => normalized.includes(w))) return "thanks";
  if (cancelHints.some((w) => normalized.includes(w))) return "cancel";
  if (angryHints.some((w) => normalized.includes(w))) return "angry";
  if (identityHints.some((w) => normalized.includes(w))) return "identity";
  if (capabilityHints.some((w) => normalized.includes(w)) && !_hasFinanceSignal(normalized))
    return "capabilities";
  if (confusedHints.some((w) => normalized.includes(w))) return "confused";
  if (reassureHints.some((w) => normalized.includes(w))) return "reassure";
  if (byeHints.some((w) => normalized.includes(w))) return "bye";
  if (
    tokenCount <= 5 &&
    casualHints.some(
      (w) => normalized === w || (w.length > 3 && normalized.includes(w)),
    )
  )
    return "casual";
  if (
    tokenCount <= 5 &&
    acknowledgeHints.some(
      (w) => normalized === w || (w.length > 3 && normalized.includes(w)),
    )
  )
    return "acknowledge";
  if (
    negativeExact.has(normalized) ||
    negativeContains.some((w) => normalized.includes(w))
  )
    return "negative";
  if (
    affirmativeExact.has(normalized) ||
    affirmativeContains.some((w) => normalized.includes(w))
  )
    return "affirmative";
  if (timeHints.some((w) => normalized.includes(w))) return "time";
  if (unknownHints.some((w) => normalized.includes(w))) return "unknown";

  // FIXED: greeting detection now uses word boundary matching for short words
  // and skips greeting if the message has clear finance intent signals
  const greetingOnly = greetingHints.some((w) => _matchesWord(normalized, w));
  if (greetingOnly && !_hasFinanceSignal(normalized)) return "greeting";

  return null;
}

export function getSmallTalkReply(type = "greeting", lastAction = null) {
  if (type === "time") {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `The time right now is ${timeStr}.`;
  }
  if (type === "affirmative") {
    if (lastAction) {
      return `Glad to hear that! Continuing from your last action (${lastAction.replace(/_/g, " ")}), what would you like to do next?`;
    }
    return "Glad to hear that! Let me know if you need any help with your finances.";
  }
  if (type === "negative" && lastAction) {
    return `No problem. We will stop the current action. Let me know what else you want to do.`;
  }
  if (type === "reassure" && lastAction === "query_balance") {
    return `Yes, I am sure. I pull these numbers directly from your logged transactions.`;
  }

  const lines = SMALLTALK_RESPONSES[type] || SMALLTALK_RESPONSES.greeting;
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}

export function getCommandStartPrefix() {
  const lines = SMALLTALK_RESPONSES.command_start || ["Yes!"];
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}
