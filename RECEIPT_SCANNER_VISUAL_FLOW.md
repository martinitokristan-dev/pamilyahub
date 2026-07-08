# Receipt Scanner Feature - Visual Flow

## Concept Overview

**Problem**: Manually logging each item from a receipt (e.g., 1x toyo, 2x oil, 1x asin) is tedious.

**Solution**: Scan receipt → AI extracts items → Log as ONE generalized expense → Tap to see itemized breakdown.

---

## User Journey Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPENSES PAGE                             │
│                                                              │
│  [+ Add Expense]  📷 [Scan Receipt]                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🛒 Groceries                    ₱1,234.50           │  │ ← Generalized
│  │    SM Supermarket • June 9, 2026                     │  │   (What user sees)
│  │    12 items • Tap to see details                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🍽️ Restaurant                   ₱850.00             │  │
│  │    Jollibee • June 8, 2026                           │  │
│  │    5 items • Tap to see details                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Scanning Receipt

```
┌──────────────────────┐
│   USER ACTION        │
│  Tap "Scan Receipt"  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│              CAMERA VIEW                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │         [Receipt Preview]                          │  │
│  │                                                     │  │
│  │    ┌─────────────────────────┐                     │  │
│  │    │  SM SUPERMARKET         │                     │  │
│  │    │  June 9, 2026           │                     │  │
│  │    │  ─────────────────      │                     │  │
│  │    │  1x Toyo Silver    45   │                     │  │
│  │    │  2x Oil Lucky     180   │                     │  │
│  │    │  1x Asin Datu      35   │                     │  │
│  │    │  ...                    │                     │  │
│  │    └─────────────────────────┘                     │  │
│  │                                                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│          [Cancel]        📸 [Capture]                     │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
                  ⏳ Processing...
                  (AI extracting data)
```

---

## Flow 2: AI Extraction Result

```
┌──────────────────────────────────────────────────────────┐
│           REVIEW SCANNED RECEIPT                          │
│                                                            │
│  Category: 🛒 Groceries                   [Change ▼]      │
│  Merchant: SM Supermarket                                 │
│  Date: June 9, 2026                       [Edit]          │
│  Total: ₱1,234.50                                         │
│                                                            │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  ITEMIZED BREAKDOWN (12 items)                            │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                            │
│  ☑️ 1x Toyo Silver Swan                        ₱45.00    │
│  ☑️ 2x Cooking Oil Lucky                       ₱180.00   │
│  ☑️ 1x Asin Datu Puti                          ₱35.00    │
│  ☑️ 3x Instant Noodles                         ₱45.00    │
│  ☑️ 1x Rice 5kg                                ₱250.00   │
│  ☑️ 2x Canned Sardines                         ₱80.00    │
│  ☑️ 1x Shampoo Palmolive                       ₱89.00    │
│  ☑️ 1x Toothpaste Colgate                      ₱65.00    │
│  ☑️ 2x Soap Safeguard                          ₱120.00   │
│  ☑️ 1x Detergent Tide 1kg                      ₱175.00   │
│  ☑️ 1x Tissue Roll                             ₱85.00    │
│  ☑️ 1x Aluminum Foil                           ₱65.50    │
│                                                            │
│  💡 Tap items to edit or remove                           │
│                                                            │
│  [Cancel]              [Save Expense]                     │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
                    ✅ Saved!
```

---

## Flow 3: Viewing Expense Details (Tap on Generalized)

```
┌──────────────────────────────────────────────────────────┐
│                 EXPENSES PAGE                             │
│                                                            │
│  User taps on "Groceries ₱1,234.50"                       │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│           EXPENSE DETAIL MODAL                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │  🛒 Groceries                         ₱1,234.50    │  │
│  │  SM Supermarket                                    │  │
│  │  June 9, 2026 • 3:45 PM                           │  │
│  │  Wallet: 💳 GCash                                  │  │
│  │                                                     │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  ITEMIZED BREAKDOWN (12 items)                    │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │                                                     │  │
│  │  1x Toyo Silver Swan                   ₱45.00     │  │
│  │  2x Cooking Oil Lucky                  ₱180.00    │  │
│  │  1x Asin Datu Puti                     ₱35.00     │  │
│  │  3x Instant Noodles                    ₱45.00     │  │
│  │  1x Rice 5kg                           ₱250.00    │  │
│  │  2x Canned Sardines                    ₱80.00     │  │
│  │  1x Shampoo Palmolive                  ₱89.00     │  │
│  │  1x Toothpaste Colgate                 ₱65.00     │  │
│  │  2x Soap Safeguard                     ₱120.00    │  │
│  │  1x Detergent Tide 1kg                 ₱175.00    │  │
│  │  1x Tissue Roll                        ₱85.00     │  │
│  │  1x Aluminum Foil                      ₱65.50     │  │
│  │                                                     │  │
│  │  📎 Receipt Image Attached                         │  │
│  │  [View Original Receipt]                           │  │
│  │                                                     │  │
│  │  [Edit]                    [Delete]                │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Data Structure

### Database Schema

```sql
-- Main Expense (Generalized)
expenses
├── id
├── user_id
├── category          -- "Groceries"
├── merchant_name     -- "SM Supermarket"
├── total_amount      -- 1234.50
├── date
├── wallet_id
├── has_items         -- true (indicates itemized breakdown exists)
├── receipt_image_url -- stored image path
└── created_at

-- Expense Items (Specific/Itemized)
expense_items
├── id
├── expense_id        -- FK to expenses.id
├── item_name         -- "Toyo Silver Swan"
├── quantity          -- 1
├── unit_price        -- 45.00
├── subtotal          -- 45.00 (quantity × unit_price)
└── line_order        -- for sorting
```

### API Response Example

```json
{
  "id": 12345,
  "category": "Groceries",
  "category_icon": "🛒",
  "merchant_name": "SM Supermarket",
  "total_amount": 1234.50,
  "date": "2026-06-09",
  "wallet": {
    "id": 5,
    "name": "GCash",
    "icon": "💳"
  },
  "has_items": true,
  "items_count": 12,
  "receipt_image_url": "/storage/receipts/user_123/receipt_12345.jpg",
  "items": [
    {
      "id": 1,
      "item_name": "Toyo Silver Swan",
      "quantity": 1,
      "unit_price": 45.00,
      "subtotal": 45.00
    },
    {
      "id": 2,
      "item_name": "Cooking Oil Lucky",
      "quantity": 2,
      "unit_price": 90.00,
      "subtotal": 180.00
    }
    // ... more items
  ]
}
```

---

## UI States

### Expenses List View (Collapsed)

```
┌────────────────────────────────────────────────────────┐
│ 🛒 Groceries                          ₱1,234.50        │ ← Shows total only
│    SM Supermarket • June 9                             │
│    12 items • Tap to see details            📋         │ ← Indicator
└────────────────────────────────────────────────────────┘
```

### Expenses List View (Regular expense, no items)

```
┌────────────────────────────────────────────────────────┐
│ 🚕 Transportation                     ₱150.00          │ ← No itemization
│    Grab • June 9                                       │
│    Single transaction                                  │
└────────────────────────────────────────────────────────┘
```

---

## Benefits

### For Users
✅ **Fast Logging** - Snap photo, done! No manual typing 12 items
✅ **Keep Details** - Have breakdown when needed (for budgeting analysis)
✅ **Clean List** - Main view isn't cluttered with every single item
✅ **Audit Trail** - Receipt photo + itemized list = complete record

### For Budget Tracking
✅ **EleFam AI can say**: "You spent ₱1,234.50 on groceries today"
✅ **Not**: "You bought toyo, oil, asin, noodles, rice..." (too detailed)
✅ **Analytics remain clean**: Categories show totals, not individual items

### For Monthly Reports
```
Groceries:           ₱15,234.00
  ├─ 8 transactions
  └─ 96 items total
```

---

## Technical Implementation Notes

### OCR/AI Options

**Option 1: Google Cloud Vision API**
- ✅ Accurate text extraction
- ✅ Multi-language support
- 💰 Pay per use (~$1.50 per 1000 images)

**Option 2: Tesseract.js (Open Source)**
- ✅ Free
- ✅ Runs in browser
- ⚠️ Less accurate for receipts

**Option 3: OpenAI GPT-4 Vision**
- ✅ Best accuracy + categorization
- ✅ Can auto-detect merchant + category
- 💰 More expensive (~$0.01 per image)

### Backend Processing Flow

```
1. User captures receipt photo
   ↓
2. Upload to server
   ↓
3. Send to OCR API
   ↓
4. Parse response:
   - Extract merchant name
   - Extract date
   - Extract line items (name, qty, price)
   - Calculate total
   ↓
5. AI categorization:
   - Analyze items → Suggest category
   - "toyo, oil, asin" → 🛒 Groceries
   ↓
6. Return to frontend for review
   ↓
7. User confirms/edits
   ↓
8. Save to database:
   - expenses table (generalized)
   - expense_items table (itemized)
```

---

## Future Enhancements

### Phase 1 (MVP)
- ✅ Scan receipt
- ✅ Manual review before saving
- ✅ View itemized breakdown

### Phase 2
- 📊 Item-level analytics ("You bought rice 4 times this month")
- 🔍 Search within items ("Show all expenses with 'shampoo'")
- 📈 Price tracking ("Oil price increased from ₱85 to ₱90")

### Phase 3
- 🤖 Auto-categorization learning (user confirms → AI learns)
- 💡 Smart suggestions ("You usually buy oil every 2 weeks, running low?")
- 🔄 Recurring item detection ("Rice appears in 80% of grocery trips")

---

## Comparison: Before vs After

### ❌ Before (Manual Entry for Every Item)

**User Experience:**
```
1. Buy groceries with 12 items
2. Open app
3. Add expense #1: Toyo ₱45
4. Add expense #2: Oil ₱180
5. Add expense #3: Asin ₱35
... (9 more times!) 😫
12. Add expense #12: Aluminum foil ₱65.50
```

**Result in list:**
```
🛒 Aluminum Foil          ₱65.50
🛒 Tissue Roll            ₱85.00
🛒 Detergent Tide         ₱175.00
🛒 Soap Safeguard         ₱120.00
... (8 more entries)
```
**Problem**: List is cluttered, hard to see the big picture!

---

### ✅ After (Receipt Scanner)

**User Experience:**
```
1. Buy groceries with 12 items
2. Open app
3. Tap "Scan Receipt"
4. Capture photo
5. Review (AI extracted everything)
6. Tap "Save"
Done! 🎉 (30 seconds total)
```

**Result in list:**
```
🛒 Groceries                    ₱1,234.50
   SM Supermarket • 12 items
   
🍽️ Restaurant                   ₱850.00
   Jollibee • 5 items
```
**Result**: Clean, organized, still have all details when needed!

---

## Mock Screenshots Reference

### Mobile View - Scan Button
```
┌─────────────────────────────┐
│  Expenses                   │
│  ───────────────────────    │
│                              │
│  [➕ Add Expense]            │
│  [📷 Scan Receipt]  ← NEW!  │
│                              │
│  June 2026            ₱5,234 │
│  ───────────────────────    │
│                              │
│  🛒 Groceries      ₱1,234.50 │
│  📋 12 items • SM Superm... │
│                              │
│  🍽️ Restaurant      ₱850.00  │
│  📋 5 items • Jollibee      │
│                              │
└─────────────────────────────┘
```

---

## EleFam AI Integration

With itemized data, EleFam can give **smarter insights**:

**Basic (without items):**
> "You spent ₱1,234 on groceries today."

**Smart (with items):**
> "You spent ₱1,234 on groceries at SM today. Rice (₱250) was your biggest item. You bought 3 instant noodles — pantry stocking up? 🍜"

**Budget Warning:**
> "Groceries this month: ₱15,234 (12 trips, 96 items). Last month was ₱12,450. Spending is up 22% — check if there are impulse buys!"

---

## Summary

This feature gives you:
1. **Speed** - Scan receipt in seconds instead of typing 12+ items
2. **Organization** - Clean list view (generalized) with drill-down details
3. **Accuracy** - AI extracts data, you verify
4. **Insights** - Item-level data enables powerful analytics later
5. **Flexibility** - Works for groceries, restaurants, shopping, bills with receipts

**Perfect for**: Grocery runs, mall shopping, restaurant bills — anything with a receipt!

**Not needed for**: Single-item expenses (transport, single coffee, parking) — use regular quick-add

---

Want me to create a spec for this feature? 🚀
