import { extractAmount, extractWalletTypeFromText } from '@/lib/chatEntities.js'

export function generateSmartFallback(text, nluResult) {
  // If we had a partial match but low confidence, ask for confirmation
  if (nluResult && nluResult.intent && nluResult.confidence >= 0.2) {
    const intentMap = {
      deposit: 'make a deposit',
      log_expense: 'log an expense',
      transfer: 'transfer money',
      create_debt: 'record a debt',
      query_balance: 'check your balance',
      query_expenses: 'check your expenses'
    }

    const readableIntent = intentMap[nluResult.intent]
    if (readableIntent) {
      return {
        ok: false,
        message: `It sounds like you want to ${readableIntent}. Is that right? Try saying "help" if you need examples.`,
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
  const normalized = text.toLowerCase()
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
    "I'm not exactly sure what you mean. Try typing \"help\" to see what I can do!",
    "I didn't quite catch that. You can type \"help\" for some examples of what to say.",
    "Hmm, I don't understand that yet. Need some tips? Type \"help\"."
  ]

  const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)]
  return {
    ok: false,
    message: randomFallback,
    kind: 'text'
  }
}
