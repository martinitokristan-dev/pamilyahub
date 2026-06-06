import { WALLET_DEFINITIONS, extractAmount } from '@/lib/chatEntities.js'
import { normalizeText } from '@/lib/chatIntents.js'

// Pre-compute regex for known wallets to inject into templates
const walletRegexStr = Object.values(WALLET_DEFINITIONS).map(w => w.name).join('|')

// Sentence templates for intent & entity extraction
// Format: { intent: string, pattern: RegExp }
// RegExp must use named capture groups: (?<amount>...), (?<wallet>...), (?<person>...), (?<reason>...)
const TEMPLATES = [
  // Expenses
  {
    intent: 'log_expense',
    pattern: /^(i|ako|ni)?\s*(spent|gastos|paid|bayad)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(on|for|sa)\s+(?<reason>[a-z0-9 ]+?)\s+(from|via|gamit( ang)?)\s+(?<wallet>[a-z0-9]+)$/i
  },
  {
    intent: 'log_expense',
    pattern: /^(i|ako|ni)?\s*(bought|beli|palit)\s+(?<reason>[a-z0-9 ]+?)\s+(for|worth|na)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(from|via|gamit( ang)?)\s+(?<wallet>[a-z0-9]+)$/i
  },
  // Deposits
  {
    intent: 'deposit',
    pattern: /^(deposit|hulog|add)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(to|sa|in)\s+(?<wallet>[a-z0-9]+)$/i
  },

  // Transfers
  {
    intent: 'transfer',
    pattern: /^(transfer|lipat|move)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(from|mula( sa)?)\s+(?<fromWallet>[a-z0-9]+)\s+(to|sa)\s+(?<toWallet>[a-z0-9]+)$/i
  },

  // Debts (Owes me)
  {
    intent: 'create_debt',
    type: 'owed_to_me',
    pattern: /^(?<person>[a-z0-9 ]+?)\s+(owes me|utang sakin|utang nako( ug)?)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'create_debt',
    type: 'owed_to_me',
    pattern: /^(?<person>[a-z0-9 ]+?)\s+(borrowed|hiniram|nangutang( ug)?)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(from me|sakin|sa akoa)$/i
  },
  {
    intent: 'create_debt',
    type: 'owed_to_me',
    pattern: /^(umutang|nangutang)\s+(si\s+)?(?<person>[a-z0-9 ]+?)\s+(sa\s+)?(akin|akoa)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'create_debt',
    type: 'owed_to_me',
    pattern: /^(pinahiram|nagpahiram)\s+(ko\s+)?(si\s+)?(?<person>[a-z0-9 ]+?)\s+(ng\s+)?(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },

  // Debts (I owe)
  {
    intent: 'create_debt',
    type: 'i_owe',
    pattern: /^(i owe|utang ko( kay)?|utang nako( kang)?)\s+(?<person>[a-z0-9 ]+?)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'create_debt',
    type: 'i_owe',
    pattern: /^(i|ako|ni)?\s*(borrowed|nangutang|hiniram)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)\s+(from|kay|kang)\s+(?<person>[a-z0-9 ]+)$/i
  },
  {
    intent: 'create_debt',
    type: 'i_owe',
    pattern: /^(umutang|nangutang)\s+(ako\s+)?(kay|kang)\s+(?<person>[a-z0-9 ]+?)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },

  // Pay Debt
  // Pay Debt (I paid them)
  {
    intent: 'pay_debt',
    type: 'i_owe',
    pattern: /^(ako|ni)?\s*(bayad|nagbayad)\s+(ako\s+)?(kay|kang|sa\s+)(?<person>[a-z0-9 ]+?)\s+(ng\s+utang\s+)?(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'pay_debt',
    type: 'i_owe',
    pattern: /^(i)?\s*(paid|pay|paide)\s+(to\s+)?(?<person>[a-z0-9 ]+?)\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'pay_debt',
    type: 'i_owe',
    pattern: /^(i|ako|ni)?\s*(paid|pay|bayad|nagbayad|paide)\s+(?!for\b|on\b|at\b|si\b)(?<person>[a-zA-Z]+(\s+[a-zA-Z]+)?)$/i
  },

  // Pay Debt (They paid me)
  {
    intent: 'pay_debt',
    type: 'owed_to_me',
    pattern: /^(?<person>[a-z0-9 ]+?)\s+(paid|paid me|paid me back|pay|pay me|pay me back|paide|paide me back|bayad|nagbayad)\s+(ng\s+utang\s+)?(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'pay_debt',
    type: 'owed_to_me',
    pattern: /^(nagbayad|bayad)\s+(si\s+)?(?<person>[a-z0-9 ]+?)\s+(ng\s+utang\s+)?(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'pay_debt',
    type: 'owed_to_me',
    pattern: /^(?!for\b|on\b|at\b)(?<person>[a-zA-Z]+(\s+[a-zA-Z]+)?)\s+(paid|paid me|paid me back|pay|pay me|pay me back|paide|paide me back|bayad|nagbayad)$/i
  },
  // Set Budget
  {
    intent: 'set_budget',
    pattern: /^(set|change|update|adjust)\s+(my\s+)?budget\s+(limit\s+)?(to|at|is)?\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  },
  {
    intent: 'set_budget',
    pattern: /^(gawing|set\s+ang|iset\s+ang)\s+budget\s+(na|to|sa)?\s+(?<amount>(php|p)?\s*\d+(\.\d+)?(k|m)?)$/i
  }
]



export function parseWithTemplates(text) {
  // Normalize input to apply typo corrections (e.g. gcsh → gcash)
  const cleanText = normalizeText(String(text || ''))
  
  for (const template of TEMPLATES) {
    if (!template.pattern) continue
    const match = cleanText.match(template.pattern)
    if (match && match.groups) {
      
      const entities = {}
      
      if (match.groups.amount) {
        entities.amount = extractAmount(match.groups.amount)
      }
      
      if (match.groups.wallet) {
        entities.walletName = match.groups.wallet.toLowerCase().trim()
      }
      if (match.groups.fromWallet) {
        entities.fromWalletName = match.groups.fromWallet.toLowerCase().trim()
      }
      if (match.groups.toWallet) {
        entities.toWalletName = match.groups.toWallet.toLowerCase().trim()
      }

      if (match.groups.person) {
        entities.person = match.groups.person.trim()
      }
      
      if (match.groups.reason) {
        entities.reason = match.groups.reason.trim()
      }

      const result = {
        intent: template.intent,
        score: 1.0, // High confidence since structural regex matched
        confidence: 1.0,
        entities
      }

      if (template.type) {
        result.entities.type = template.type
      }

      return result
    }
  }

  return null
}
