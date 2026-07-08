# Receipt Items Details Feature - Technical Design

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Vue.js)                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │         ScanReceiptModal.vue                       │ │
│  │  - Scans receipt                                   │ │
│  │  - Emits scannedData with items + fees             │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                   │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │         ExpenseModal.vue                           │ │
│  │  - Receives scannedData                            │ │
│  │  - Stores in form.receipt_items                    │ │
│  │  - Sends to API on save                            │ │
│  │  - Displays ReceiptItemsSection if items exist     │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                   │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │    ReceiptItemsSection.vue (NEW)                   │ │
│  │  - Shows/hides items with toggle                   │ │
│  │  - Displays items and fees separately              │ │
│  │  - Read-only display                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────┬───────────────────────────────────┘
                        │ HTTP POST/PUT /api/expenses
                        ▼
┌─────────────────────────────────────────────────────────┐
│                Backend (Laravel API)                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │         ExpenseController.php                      │ │
│  │  - Validates receipt_items JSON                    │ │
│  │  - Passes to ExpenseService                        │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                   │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │         ExpenseService.php                         │ │
│  │  - Creates/updates expense with receipt_items      │ │
│  │  - Calls ExpenseRepository                         │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                   │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │         ExpenseRepository.php                      │ │
│  │  - Saves expense with receipt_items JSON           │ │
│  │  - Returns expense with parsed receipt_items       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Database (MySQL)                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  expenses table:                                         │
│  - id (bigint)                                           │
│  - user_id (bigint)                                      │
│  - title (varchar) - category                           │
│  - amount (decimal)                                      │
│  - description (text) - merchant + item count            │
│  - date (date)                                           │
│  - wallet_id (bigint)                                    │
│  - receipt_items (json) ← NEW COLUMN                     │
│  - created_at (timestamp)                                │
│  - updated_at (timestamp)                                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### Migration: Add receipt_items Column

```php
// database/migrations/YYYY_MM_DD_HHMMSS_add_receipt_items_to_expenses.php

public function up()
{
    Schema::table('expenses', function (Blueprint $table) {
        $table->json('receipt_items')->nullable()->after('description');
    });
}

public function down()
{
    Schema::table('expenses', function (Blueprint $table) {
        $table->dropColumn('receipt_items');
    });
}
```

### JSON Structure for receipt_items

```json
{
  "items": [
    {
      "itemName": "Brioche w/White Sturgeon, Crème Fraiche and Chives",
      "quantity": 1,
      "unitPrice": 29.00,
      "subtotal": 29.00,
      "type": "item"
    },
    {
      "itemName": "Pinot Noir",
      "quantity": 10,
      "unitPrice": 5.00,
      "subtotal": 50.00,
      "type": "item"
    }
  ],
  "fees": [
    {
      "itemName": "10% Service",
      "quantity": 1,
      "unitPrice": 28.20,
      "subtotal": 28.20,
      "type": "fee"
    }
  ],
  "itemsSubtotal": 79.00,
  "feesSubtotal": 28.20,
  "total": 107.20,
  "itemCount": 2,
  "feeCount": 1,
  "merchantName": "ROCKPOOL",
  "scannedAt": "2026-06-09T13:31:00Z"
}
```

## Backend Implementation

### Model Update: Expense.php

```php
// app/Models/Expense.php

protected $fillable = [
    'user_id',
    'title',
    'amount',
    'description',
    'date',
    'wallet_id',
    'receipt_items', // NEW
];

protected $casts = [
    'amount' => 'decimal:2',
    'date' => 'date',
    'receipt_items' => 'array', // Auto JSON decode/encode
];

// Accessor to get item count for display
public function getItemCountAttribute()
{
    if (!$this->receipt_items || !isset($this->receipt_items['itemCount'])) {
        return null;
    }
    return $this->receipt_items['itemCount'];
}

// Accessor to check if expense is from scan
public function getIsScannedAttribute()
{
    return !empty($this->receipt_items);
}
```

### Controller Update: ExpenseController.php

```php
// app/Http/Controllers/ExpenseController.php

public function store(StoreExpenseRequest $request)
{
    $data = $request->validated();
    
    // Handle receipt_items if present
    if ($request->has('receipt_items')) {
        $data['receipt_items'] = $request->receipt_items;
    }
    
    $expense = $this->service->create($data);
    
    return response()->json($expense, 201);
}

public function update(StoreExpenseRequest $request, $id)
{
    $data = $request->validated();
    
    // Handle receipt_items if present
    if ($request->has('receipt_items')) {
        $data['receipt_items'] = $request->receipt_items;
    }
    
    $expense = $this->service->update($id, $data);
    
    return response()->json($expense);
}
```

### Request Validation: StoreExpenseRequest.php

```php
// app/Http/Requests/StoreExpenseRequest.php

public function rules()
{
    return [
        'title' => 'required|string|max:255',
        'amount' => 'required|numeric|min:0',
        'description' => 'nullable|string',
        'date' => 'required|date',
        'wallet_id' => 'nullable|exists:wallets,id',
        'receipt_items' => 'nullable|array', // NEW
        'receipt_items.items' => 'nullable|array',
        'receipt_items.fees' => 'nullable|array',
        'receipt_items.itemsSubtotal' => 'nullable|numeric',
        'receipt_items.feesSubtotal' => 'nullable|numeric',
        'receipt_items.total' => 'nullable|numeric',
        'receipt_items.itemCount' => 'nullable|integer',
        'receipt_items.feeCount' => 'nullable|integer',
        'receipt_items.merchantName' => 'nullable|string',
        'receipt_items.scannedAt' => 'nullable|string',
    ];
}
```

## Frontend Implementation

### Component: ReceiptItemsSection.vue (NEW)

```vue
<script setup>
import { ref } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'

const props = defineProps({
  receiptItems: {
    type: Object,
    required: true
    // Expected: { items: [], fees: [], itemsSubtotal, feesSubtotal, total, ... }
  }
})

const isExpanded = ref(true) // Default: show items

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4">
    <!-- Header with toggle -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receipt Items</h3>
      <UiButton
        type="button"
        variant="ghost"
        size="sm"
        @click="toggleExpanded"
        class="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
      >
        {{ isExpanded ? 'Hide Items' : 'Show Items' }}
        <ChevronUp v-if="isExpanded" class="h-3 w-3" />
        <ChevronDown v-else class="h-3 w-3" />
      </UiButton>
    </div>

    <!-- Expandable content -->
    <div v-if="isExpanded" class="space-y-4">
      <!-- Items Section -->
      <div v-if="receiptItems.items && receiptItems.items.length > 0">
        <div class="flex items-center justify-between mb-2 pb-1 border-b border-border/50">
          <span class="text-xs font-semibold text-muted-foreground uppercase">Items ({{ receiptItems.itemCount }})</span>
        </div>
        
        <div class="space-y-2">
          <div
            v-for="(item, index) in receiptItems.items"
            :key="'item-' + index"
            class="flex items-start justify-between gap-3 text-sm"
          >
            <div class="flex-1">
              <div class="font-medium text-foreground">{{ item.itemName }}</div>
              <div class="text-xs text-muted-foreground">{{ item.quantity }}x @ ₱{{ item.unitPrice.toFixed(2) }}</div>
            </div>
            <span class="font-semibold text-foreground tabular-nums">₱{{ item.subtotal.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Items Subtotal (if fees exist) -->
        <div v-if="receiptItems.fees && receiptItems.fees.length > 0" class="mt-3 pt-2 border-t border-dashed border-border/50 flex items-center justify-between text-sm">
          <span class="text-muted-foreground font-medium">Subtotal</span>
          <span class="font-semibold text-foreground tabular-nums">₱{{ receiptItems.itemsSubtotal.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Fees Section -->
      <div v-if="receiptItems.fees && receiptItems.fees.length > 0" class="pt-3 border-t border-border">
        <div class="flex items-center justify-between mb-2 pb-1 border-b border-border/50">
          <span class="text-xs font-semibold text-muted-foreground uppercase">Other Charges ({{ receiptItems.feeCount }})</span>
          <span class="text-xs text-amber-600">Tax, Service, Fees</span>
        </div>
        
        <div class="space-y-2">
          <div
            v-for="(fee, index) in receiptItems.fees"
            :key="'fee-' + index"
            class="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/30"
          >
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium text-foreground">{{ fee.itemName }}</span>
              <span class="font-semibold text-foreground tabular-nums">₱{{ fee.subtotal.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Total -->
      <div class="pt-3 border-t-2 border-foreground/20">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-foreground uppercase">Total</span>
          <span class="text-lg font-black text-foreground tabular-nums">₱{{ receiptItems.total.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

### Update: ExpenseModal.vue

```vue
<script setup>
// ... existing imports ...
import ReceiptItemsSection from '@/components/expense/ReceiptItemsSection.vue'

// ... existing code ...

// Add receipt_items to form
const form = ref({ 
  title: '', 
  amount: '', 
  description: '', 
  date: '', 
  wallet_id: null,
  receipt_items: null // NEW
})

// Update handleScanned to store receipt items
function handleScanned(scannedData) {
  isFromScan.value = true
  
  // Auto-fill form with scanned data
  form.value.amount = scannedData.total.toFixed(2)
  form.value.date = scannedData.date
  form.value.description = `${scannedData.merchantName} • ${scannedData.itemCount} items`
  
  // Store receipt items
  form.value.receipt_items = {
    items: scannedData.items,
    fees: scannedData.fees,
    itemsSubtotal: scannedData.itemsSubtotal,
    feesSubtotal: scannedData.feesSubtotal,
    total: scannedData.total,
    itemCount: scannedData.itemCount,
    feeCount: scannedData.feeCount,
    merchantName: scannedData.merchantName,
    scannedAt: new Date().toISOString()
  }
  
  showScanReceipt.value = false
}

// Update watch to load receipt_items when editing
watch(() => props.show, (val) => {
  if (val) {
    balanceError.value = ''
    if (props.expenseId) {
      const expense = store.expenses.find(e => e.id === props.expenseId) || store.feedItems.find(e => e.id === props.expenseId)
      if (expense) {
        form.value = {
          title: expense.title,
          amount: parseExpenseAmount(expense.amount),
          description: expense.description ?? '',
          date: typeof expense.date === 'string' ? expense.date.slice(0, 10) : expense.date,
          wallet_id: expense.wallet_id ?? null,
          receipt_items: expense.receipt_items ?? null, // NEW
        }
      }
      isFromScan.value = false
    } else {
      // ... reset form for new expense
      form.value.receipt_items = null
      isFromScan.value = false
    }
    initialForm.value = JSON.stringify(form.value)
  }
})
</script>

<template>
  <!-- ... existing template ... -->
  
  <div class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4 shrink-0">
    <!-- Pay from Wallet section ... -->
  </div>

  <!-- Receipt Items Section (NEW) -->
  <ReceiptItemsSection
    v-if="form.receipt_items"
    :receipt-items="form.receipt_items"
  />
  
  <!-- ... rest of template ... -->
</template>
```

### Update: Expense List Display

```vue
<!-- In expense list component (e.g., Expenses.vue) -->

<template>
  <div class="expense-item">
    <div class="expense-title">
      {{ expense.title }}
      <span v-if="expense.receipt_items && expense.receipt_items.itemCount" class="text-muted-foreground text-sm">
        - {{ expense.receipt_items.itemCount }} {{ expense.receipt_items.itemCount === 1 ? 'item' : 'items' }}
      </span>
    </div>
    <!-- ... rest of expense item ... -->
  </div>
</template>
```

## API Endpoints

### POST /api/expenses

**Request:**
```json
{
  "title": "Groceries",
  "amount": 311.20,
  "description": "ROCKPOOL • 5 items",
  "date": "2026-06-09",
  "wallet_id": 1,
  "receipt_items": {
    "items": [...],
    "fees": [...],
    "itemsSubtotal": 283.00,
    "feesSubtotal": 28.20,
    "total": 311.20,
    "itemCount": 5,
    "feeCount": 1,
    "merchantName": "ROCKPOOL",
    "scannedAt": "2026-06-09T13:31:00Z"
  }
}
```

**Response:**
```json
{
  "id": 123,
  "user_id": 1,
  "title": "Groceries",
  "amount": "311.20",
  "description": "ROCKPOOL • 5 items",
  "date": "2026-06-09",
  "wallet_id": 1,
  "receipt_items": { ... },
  "created_at": "2026-06-09T13:31:00.000000Z",
  "updated_at": "2026-06-09T13:31:00.000000Z"
}
```

### GET /api/expenses/{id}

**Response:**
```json
{
  "id": 123,
  "user_id": 1,
  "title": "Groceries",
  "amount": "311.20",
  "description": "ROCKPOOL • 5 items",
  "date": "2026-06-09",
  "wallet_id": 1,
  "receipt_items": {
    "items": [
      {
        "itemName": "Brioche w/White Sturgeon",
        "quantity": 1,
        "unitPrice": 29.00,
        "subtotal": 29.00,
        "type": "item"
      }
    ],
    "fees": [
      {
        "itemName": "10% Service",
        "quantity": 1,
        "unitPrice": 28.20,
        "subtotal": 28.20,
        "type": "fee"
      }
    ],
    "itemsSubtotal": 283.00,
    "feesSubtotal": 28.20,
    "total": 311.20,
    "itemCount": 5,
    "feeCount": 1,
    "merchantName": "ROCKPOOL",
    "scannedAt": "2026-06-09T13:31:00Z"
  },
  "created_at": "2026-06-09T13:31:00.000000Z",
  "updated_at": "2026-06-09T13:31:00.000000Z"
}
```

## Error Handling

### Invalid JSON Structure
```php
// In ExpenseRepository.php

public function create(array $data)
{
    try {
        // Validate receipt_items structure if present
        if (isset($data['receipt_items'])) {
            $this->validateReceiptItems($data['receipt_items']);
        }
        
        return Expense::create($data);
    } catch (\Exception $e) {
        Log::error('Failed to create expense with receipt items', [
            'error' => $e->getMessage(),
            'data' => $data
        ]);
        throw $e;
    }
}

private function validateReceiptItems($receiptItems)
{
    if (!is_array($receiptItems)) {
        throw new \InvalidArgumentException('receipt_items must be an array');
    }
    
    // Validate required fields
    $requiredFields = ['items', 'fees', 'itemsSubtotal', 'feesSubtotal', 'total'];
    foreach ($requiredFields as $field) {
        if (!array_key_exists($field, $receiptItems)) {
            throw new \InvalidArgumentException("receipt_items missing required field: {$field}");
        }
    }
}
```

### Corrupted Data Recovery
```vue
<!-- In ReceiptItemsSection.vue -->

<script setup>
import { computed } from 'vue'

const props = defineProps({
  receiptItems: {
    type: Object,
    required: true
  }
})

// Validate and sanitize receipt items
const sanitizedItems = computed(() => {
  if (!props.receiptItems) return null
  
  try {
    return {
      items: Array.isArray(props.receiptItems.items) ? props.receiptItems.items : [],
      fees: Array.isArray(props.receiptItems.fees) ? props.receiptItems.fees : [],
      itemsSubtotal: parseFloat(props.receiptItems.itemsSubtotal) || 0,
      feesSubtotal: parseFloat(props.receiptItems.feesSubtotal) || 0,
      total: parseFloat(props.receiptItems.total) || 0,
      itemCount: parseInt(props.receiptItems.itemCount) || 0,
      feeCount: parseInt(props.receiptItems.feeCount) || 0
    }
  } catch (error) {
    console.error('Failed to parse receipt items:', error)
    return null
  }
})
</script>

<template>
  <div v-if="sanitizedItems">
    <!-- Display sanitized items -->
  </div>
</template>
```

## Testing Strategy

### Backend Tests

```php
// tests/Feature/ExpenseReceiptItemsTest.php

class ExpenseReceiptItemsTest extends TestCase
{
    /** @test */
    public function it_stores_receipt_items_with_expense()
    {
        $user = User::factory()->create();
        $wallet = Wallet::factory()->create(['user_id' => $user->id]);
        
        $receiptItems = [
            'items' => [
                [
                    'itemName' => 'Test Item',
                    'quantity' => 2,
                    'unitPrice' => 10.00,
                    'subtotal' => 20.00,
                    'type' => 'item'
                ]
            ],
            'fees' => [],
            'itemsSubtotal' => 20.00,
            'feesSubtotal' => 0,
            'total' => 20.00,
            'itemCount' => 1,
            'feeCount' => 0
        ];
        
        $response = $this->actingAs($user)->postJson('/api/expenses', [
            'title' => 'Groceries',
            'amount' => 20.00,
            'description' => 'Test',
            'date' => '2026-06-09',
            'wallet_id' => $wallet->id,
            'receipt_items' => $receiptItems
        ]);
        
        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'title' => 'Groceries',
            'amount' => 20.00
        ]);
        
        $expense = Expense::latest()->first();
        $this->assertNotNull($expense->receipt_items);
        $this->assertEquals(1, $expense->receipt_items['itemCount']);
    }
    
    /** @test */
    public function it_does_not_store_receipt_items_for_manual_expenses()
    {
        $user = User::factory()->create();
        $wallet = Wallet::factory()->create(['user_id' => $user->id]);
        
        $response = $this->actingAs($user)->postJson('/api/expenses', [
            'title' => 'Coffee',
            'amount' => 5.00,
            'description' => 'Morning coffee',
            'date' => '2026-06-09',
            'wallet_id' => $wallet->id
        ]);
        
        $response->assertStatus(201);
        
        $expense = Expense::latest()->first();
        $this->assertNull($expense->receipt_items);
    }
}
```

### Frontend Tests

```javascript
// tests/components/ReceiptItemsSection.spec.js

import { mount } from '@vue/test-utils'
import ReceiptItemsSection from '@/components/expense/ReceiptItemsSection.vue'

describe('ReceiptItemsSection', () => {
  const mockReceiptItems = {
    items: [
      { itemName: 'Item 1', quantity: 1, unitPrice: 10, subtotal: 10, type: 'item' },
      { itemName: 'Item 2', quantity: 2, unitPrice: 5, subtotal: 10, type: 'item' }
    ],
    fees: [
      { itemName: 'Service', quantity: 1, unitPrice: 2, subtotal: 2, type: 'fee' }
    ],
    itemsSubtotal: 20,
    feesSubtotal: 2,
    total: 22,
    itemCount: 2,
    feeCount: 1
  }
  
  it('renders receipt items by default (expanded)', () => {
    const wrapper = mount(ReceiptItemsSection, {
      props: { receiptItems: mockReceiptItems }
    })
    
    expect(wrapper.find('.expense-item').exists()).toBe(true)
    expect(wrapper.text()).toContain('Item 1')
    expect(wrapper.text()).toContain('Item 2')
  })
  
  it('toggles items visibility when clicking hide/show button', async () => {
    const wrapper = mount(ReceiptItemsSection, {
      props: { receiptItems: mockReceiptItems }
    })
    
    const toggleButton = wrapper.find('button')
    expect(toggleButton.text()).toContain('Hide Items')
    
    await toggleButton.trigger('click')
    expect(toggleButton.text()).toContain('Show Items')
    expect(wrapper.find('.expense-item').exists()).toBe(false)
    
    await toggleButton.trigger('click')
    expect(toggleButton.text()).toContain('Hide Items')
    expect(wrapper.find('.expense-item').exists()).toBe(true)
  })
  
  it('displays items and fees separately', () => {
    const wrapper = mount(ReceiptItemsSection, {
      props: { receiptItems: mockReceiptItems }
    })
    
    expect(wrapper.text()).toContain('Items (2)')
    expect(wrapper.text()).toContain('Other Charges (1)')
    expect(wrapper.text()).toContain('Service')
  })
})
```

## Performance Considerations

### Database Indexing
- No additional indexes needed for `receipt_items` JSON column
- Existing indexes on `user_id` and `date` sufficient for queries

### Query Optimization
- Receipt items are fetched as part of expense query (no JOIN needed)
- JSON parsing happens in memory (minimal overhead)

### Caching Strategy
- Expense list can be cached with receipt items included
- No separate cache invalidation needed for receipt items

## Security Considerations

### Input Validation
- Validate receipt_items JSON structure before saving
- Sanitize item names to prevent XSS
- Limit array sizes to prevent memory issues

### Authorization
- Only expense owner can view receipt items
- Receipt items follow same auth rules as parent expense

### Data Privacy
- Receipt items are personal data - handle per GDPR
- Include in data export/deletion workflows

## Deployment Plan

### Phase 1: Database Migration
1. Run migration to add `receipt_items` column
2. Verify column exists in production
3. Monitor for any migration errors

### Phase 2: Backend Deployment
1. Deploy updated models, controllers, services
2. Test API endpoints with Postman
3. Verify JSON storage and retrieval

### Phase 3: Frontend Deployment
1. Deploy new component and updated modal
2. Test scanning and saving with receipt items
3. Verify display in expense modal

### Phase 4: Monitoring
1. Monitor API error rates
2. Check for JSON parsing errors
3. Verify performance metrics

## Rollback Plan

If issues arise:
1. Revert frontend changes (hide ReceiptItemsSection)
2. Keep backend changes (receipt_items column harmless if unused)
3. Investigate and fix issues
4. Re-deploy when ready

The `receipt_items` column being nullable allows for graceful degradation.
