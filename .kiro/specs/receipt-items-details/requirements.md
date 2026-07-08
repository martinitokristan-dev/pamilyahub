# Receipt Items Details Feature - Requirements

## Introduction

This feature adds the ability to store and display detailed receipt items for expenses created via receipt scanning. When users scan a receipt and save it as an expense, all individual items (quantities, prices) are preserved and can be viewed later in the expense modal.

## Glossary

- **Receipt Items**: Individual line items from a scanned receipt (e.g., "Brioche", "Pinot Noir")
- **Fees**: Additional charges like service charge, tax, VAT
- **Scanned Expense**: An expense created by scanning a receipt (vs manual entry)
- **Manual Expense**: An expense created by typing details manually
- **Receipt Items Section**: The expandable UI section in expense modal showing receipt details

## User Stories & Requirements

### Requirement 1: Store Receipt Items with Expense

**User Story:** As a user who scans receipts, I want my receipt items to be saved with the expense so that I can review what I purchased later.

#### Acceptance Criteria

1. WHERE the user scans a receipt and taps "Save" in the scan result modal, WHEN they fill the expense form and save, THEN the receipt items (items + fees) SHALL be stored in the database
2. WHERE receipt items are stored, THE system SHALL preserve: item name, quantity, unit price, subtotal, and type (item or fee)
3. WHERE the expense is created manually (not from scan), THE system SHALL NOT store receipt items
4. WHERE receipt items exist for an expense, THE system SHALL return them when fetching expense details

### Requirement 2: Display Receipt Items in Expense Modal

**User Story:** As a user viewing a scanned expense, I want to see the individual receipt items below the wallet section so that I can review the purchase breakdown.

#### Acceptance Criteria

1. WHERE the user opens an expense that has receipt items, WHEN the expense modal loads, THEN a "Receipt Items" section SHALL appear below the "Pay from Wallet" section
2. WHERE the expense has no receipt items (manual entry), THE "Receipt Items" section SHALL NOT be displayed
3. WHERE the Receipt Items section is displayed, THE default state SHALL be expanded (items visible)
4. WHERE the user taps "Hide Items", THE items list SHALL collapse and button text SHALL change to "Show Items"
5. WHERE the user taps "Show Items", THE items list SHALL expand and button text SHALL change to "Hide Items"

### Requirement 3: Receipt Items Section Layout

**User Story:** As a user viewing receipt items, I want to see items and fees separated clearly so that I can understand the cost breakdown.

#### Acceptance Criteria

1. WHERE receipt items are displayed, THE section SHALL show two subsections: "Items" and "Other Charges"
2. WHERE items exist, THE "Items" subsection SHALL display each item with: name, quantity, unit price, and subtotal
3. WHERE fees exist, THE "Other Charges" subsection SHALL display each fee with: name and amount
4. WHERE items exist, THE "Items" subsection SHALL show an items subtotal (sum of all item subtotals)
5. WHERE fees exist, THE "Other Charges" subsection SHALL be visually distinct (e.g., amber background like scan result modal)
6. WHERE both items and fees exist, THE total SHALL be displayed at the bottom (items subtotal + fees subtotal)

### Requirement 4: Expense List Display Enhancement

**User Story:** As a user browsing my expenses, I want scanned receipts to show the item count so that I can identify bulk purchases at a glance.

#### Acceptance Criteria

1. WHERE an expense has receipt items, WHEN displayed in the expense list, THEN the title SHALL include the item count (e.g., "Groceries - 5 items")
2. WHERE an expense has no receipt items, WHEN displayed in the expense list, THEN the title SHALL show only the category (e.g., "Groceries")
3. WHERE the item count is displayed, THE format SHALL be: "{category} - {count} items"
4. WHERE the item count is 1, THE format SHALL be: "{category} - 1 item" (singular)

### Requirement 5: Read-Only Receipt Items

**User Story:** As a user viewing receipt items in the expense modal, I want the items to be read-only so that the original receipt data is preserved.

#### Acceptance Criteria

1. WHERE receipt items are displayed in the expense modal, THE items SHALL be read-only (no edit, add, or delete functionality)
2. WHERE the user wants to modify the expense amount, THEY SHALL use the main amount field at the top
3. WHERE the user deletes the expense, THE receipt items SHALL also be deleted from the database

### Requirement 6: API Support for Receipt Items

**User Story:** As a developer, I want the backend API to support storing and retrieving receipt items so that the feature works correctly.

#### Acceptance Criteria

1. WHERE the backend receives an expense create request with receipt items, THE system SHALL store the items in a JSON column
2. WHERE the backend receives an expense update request with receipt items, THE system SHALL update the items in the database
3. WHERE the backend returns expense details, IF receipt items exist, THE system SHALL include them in the response
4. WHERE the receipt items JSON is invalid or corrupted, THE system SHALL return an empty array and log a warning

## Correctness Properties

### Property 1: Receipt Items Preservation
**Invariant:** IF an expense is created from a scanned receipt with N items, THEN the expense SHALL have exactly N items stored in the database.

**Test Strategy:** 
- Scan receipt with 5 items
- Save as expense
- Fetch expense from API
- Assert: receipt_items array has 5 elements

### Property 2: Manual Expense Exclusion
**Invariant:** IF an expense is created manually (not from scan), THEN the receipt_items field SHALL be null or empty.

**Test Strategy:**
- Create expense manually via form
- Fetch expense from API
- Assert: receipt_items is null or []

### Property 3: Item Count Display
**Invariant:** IF an expense has N items in receipt_items, THEN the expense list SHALL display "{category} - N items".

**Test Strategy:**
- Create scanned expense with 3 items
- Load expense list page
- Assert: expense title includes "- 3 items"

### Property 4: Toggle State Persistence
**Invariant:** WHEN the user toggles "Show/Hide Items", THE section SHALL expand/collapse without data loss.

**Test Strategy:**
- Open expense with receipt items
- Click "Hide Items"
- Click "Show Items"
- Assert: All items still displayed correctly

### Property 5: Fee Separation
**Invariant:** IF a receipt has both items and fees, THEN the "Items" and "Other Charges" sections SHALL display separately.

**Test Strategy:**
- Scan receipt with 3 items + 1 service charge
- Save and reopen expense
- Assert: Items section has 3 entries
- Assert: Other Charges section has 1 entry

## Non-Functional Requirements

### Performance
- WHERE receipt items are fetched from API, THE response time SHALL be under 500ms
- WHERE the expense modal opens with receipt items, THE rendering SHALL complete within 200ms

### Data Integrity
- WHERE receipt items are stored, THE JSON structure SHALL be validated before saving
- WHERE receipt items are corrupted, THE system SHALL gracefully handle errors without crashing

### Accessibility
- WHERE the "Show/Hide Items" button is displayed, IT SHALL be keyboard accessible
- WHERE receipt items are displayed, THE content SHALL have appropriate ARIA labels

### Mobile Responsiveness
- WHERE receipt items are displayed on mobile, THE layout SHALL adapt to smaller screens without horizontal scrolling
- WHERE the items list is long, THE section SHALL be scrollable within the modal

## Out of Scope

- Editing individual receipt items (read-only only)
- Adding new items manually after scanning
- Removing items from scanned receipts
- Exporting receipt items to PDF or CSV
- Receipt image storage and display
- Multi-currency support for receipt items
- Receipt item categories or tags
