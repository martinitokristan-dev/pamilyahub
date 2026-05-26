import { extractAmount, extractWalletTypeFromText } from '@/lib/chatEntities.js'

function looksLikeOnboardingQuestion(text = '') {
  const normalized = String(text || '').toLowerCase()
  return /\b(im|i am)\s+new\b|\bnew\s+here\b|\bfirst\s*time\b|\bfrom\s+scratch\b|\bwhat\s+should\s+i\s+do\s+first\b|\bwhat\s+should\s+i\s+set\s+up\s+first\b|\bset\s*up\s+first\b|\bwhere\s+do\s+i\s+start\b|\bstart\s+tracking\b|\bbegin\b|\bdont\s+know\b/.test(normalized)
}

export function generateSmartFallback(text, nluResult) {
  const normalized = String(text || '').toLowerCase()

  if (/\bwhat\s+did\s+you\s+understand\b|\bwhat\s+do\s+you\s+understand\b|\bdid\s+you\s+understand\b|\bmy\s+last\s+request\b/.test(normalized)) {
    return {
      ok: false,
      message: 'I understand finance requests in this app. If you want, restate your goal in one line (for example: "show my latest expenses" or "set my budget to 12000") and I will execute or guide you step by step.',
      kind: 'text'
    }
  }

  if (looksLikeOnboardingQuestion(text)) {
    return {
      ok: false,
      message: "Great question. If you're new, start by adding your first wallet. You can say: \"new wallet GCash 0\". After that, I can guide you to deposit money, log expenses, and check your budget.",
      kind: 'text'
    }
  }

  // If we had a partial match but low confidence, ask for confirmation
  if (nluResult && nluResult.intent && nluResult.confidence >= 0.2) {
    const intentMap = {
      deposit: 'make a deposit',
      log_expense: 'log an expense',
      transfer: 'transfer money',
      create_debt: 'record a debt',
      query_balance: 'check your balance',
      query_expenses: 'check your expenses',
      query_debts: 'review your debts',
      set_budget: 'set your budget',
      ask_help: 'get help with available finance commands',
    }

    const readableIntent = intentMap[nluResult.intent]
    if (readableIntent) {
      return {
        ok: false,
        message: `I might be reading this as a request to ${readableIntent}. If that's right, say \"yes\". If not, tell me your goal like \"guide me to add wallet\" or \"show me how to log expense\".`,
        kind: 'text'
      }
    }
  }

  // If we couldn't match intent, but we found entities, make an educated guess
  const amount = extractAmount(text)
  const walletType = extractWalletTypeFromText(text)

  if (amount) {
    return {
      ok: false,
      message: `I see you mentioned ₱${amount.toLocaleString()}. Are you trying to deposit, log an expense, or transfer this amount?`,
      kind: 'text',
      context: { amount }
    }
  }

  if (walletType) {
    return {
      ok: false,
      message: `I see you mentioned ${walletType.toUpperCase()}. Would you like to check the balance, deposit, or log an expense from it?`,
      kind: 'text',
      context: { walletType }
    }
  }

  // If message contains a person name hint + amount → suggest debt
  const hasPerson = /\b[A-Z][a-z]+\b/.test(text) // Capitalized word = likely name
  if (amount && hasPerson) {
    return {
      ok: false,
      message: `I see a name and an amount of ₱${amount.toLocaleString()}. Are you logging a debt? Try: "I owe [name] ${amount}" or "[name] owes me ${amount}".`,
      kind: 'text',
      context: { amount }
    }
  }

  // Complete fallback
  const fallbacks = [
    "I can help with finance tasks in this app: wallet, deposit, transfer, expense, debt, and budget. Tell me your goal in your own words and I'll guide you.",
    "I didn't fully catch that yet. Try: \"I want to start tracking my money\", \"check my wallet balance\", or \"help me log an expense\".",
    "I can guide you step by step. Start with one goal: add wallet, deposit money, transfer funds, log expense, track debt, or check budget."
  ]

  const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)]
  return {
    ok: false,
    message: randomFallback,
    kind: 'text'
  }
}
