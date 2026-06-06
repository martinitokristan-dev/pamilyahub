---
name: elefam-web-development
description: >
  ALWAYS activate this skill for any web development task — frontend, backend, full-stack,
  debugging, UI/UX, or code review. This is the single unified skill for all EleFam/PamilyaHub
  development. Triggers include: writing features, creating components, building endpoints,
  styling UI, designing forms, handling user input, managing state, writing validation,
  building screens involving money/stock/quantity, reviewing code, refactoring, starting new
  files, debugging bugs, tracing errors, fixing crashes, investigating unexpected behavior,
  or any task that touches the codebase. This skill enforces senior-level architecture,
  constraint validation, premium UI/UX, structured debugging, and clean code standards.
  Use for greenfield projects, existing projects, code reviews, and architecture decisions.
---

# EleFam Web Development Skill

Senior-level standards for professional web development — architecture, UI/UX, validation,
debugging, and deployment. Stack-agnostic. Applies to any backend + frontend combination.

> ⚠️ **Core Principle**: Code that works is not enough. It must be correct, safe, consistent,
> maintainable, and beautiful.

---

## Part 1 — Before Writing Any Code

Run this checklist **every time** before touching code:

```
[ ] Does this file/function/component already exist? Search before creating.
[ ] Is the logic I'm about to write in the right layer? (see Architecture)
[ ] Does this feature touch money, stock, quantity, or any limited resource?
    → If yes: constraint validation is MANDATORY (see Validation)
[ ] Am I duplicating a pattern that already exists in this codebase?
[ ] Does this UI interaction need a loading state, empty state, and error state?
[ ] Will this change affect dark mode? Test both themes.
```

---

## Part 2 — Architecture

### Backend: Thin Controller → Service → Repository

Controllers must be thin. This is the single most violated rule in web development.

```
HTTP Request
    │
    ▼
FormRequest / DTO       ← validates shape and types only
    │
    ▼
Controller              ← receives, delegates, returns response (≤ 15 lines per method)
    │
    ▼
Service                 ← ALL business logic, rules, constraints, orchestration
    │
    ▼
Repository              ← ALL database queries (zero business logic)
    │
    ▼
Model / ORM             ← relationships, casts, fillable — nothing else
    │
    ▼
Database
```

| Layer | Does | Never Does |
|---|---|---|
| Controller | validate input, call one service method, return response | DB queries, if-chains, business rules |
| Service | enforce business rules, call repos, throw domain exceptions | DB queries, HTTP concerns, response formatting |
| Repository | query the DB, return data | business logic, permissions, HTTP anything |
| Model | define relationships, casts, fillable | query logic, business rules |

### Frontend: View → Component → Store → API

```
Route / Page (View)
    │
    ▼
Dumb Components         ← receive props, emit events, no business logic
    │
    ▼
Store / State           ← ALL API calls, ALL global state, cache management
    │
    ▼
API Client (shared)     ← one configured instance (axios, fetch wrapper, etc.)
    │
    ▼
Backend REST API
```

- **Views** = layout + composition only. No direct API calls. No raw logic.
- **Components** = accept props, emit events upward. No store access unless "smart/container" components.
- **Stores** = the only place API calls live. Handles optimistic updates, rollback, and cache.

### EleFam-Specific Architecture Rules

- **Backend (`/backend`)**: Laravel REST API. Stateless, Bearer token auth. Follow Laravel's directory structure strictly (`app/Http/Controllers`, `app/Models`, `app/Repositories`, `routes/api.php`).
- **Frontend (`/frontend`)**: Vue 3 + Vite PWA. Structure: `src/components/` (reusable), `src/views/` (pages), `src/stores/` (Pinia), `src/lib/` & `src/utils/` (helpers).
- **UI Components**: ALWAYS use existing Shadcn UI components in `frontend/src/components/ui/` (`UiButton`, `UiCard`, `UiInput`, etc.) — never build raw HTML inputs or buttons.
- **Styling**: Tailwind CSS for all styling. No raw CSS unless absolutely necessary (specific animations or third-party overrides).
- **State Management**: Always Pinia for global state. Follow established patterns for optimistic UI updates and cache invalidation.

---

## Part 3 — No Redundancy

Every piece of logic must live in exactly **one** place.

Before creating anything new, search for:

**Backend:**
- [ ] Service already handling this domain?
- [ ] Repository method already doing this query?
- [ ] FormRequest / validator already covering this shape?
- [ ] Response formatter / serializer already existing for this model?
- [ ] Route already registered?

**Frontend:**
- [ ] Component already built for this UI pattern?
- [ ] Store action already fetching/mutating this data?
- [ ] Composable / hook already encapsulating this logic?
- [ ] Utility / helper already doing this transformation?
- [ ] This exact view already exists under a different route name?

**Rule**: If an existing piece covers 80%+ of what you need — extend it, do not clone it.
One file owns one concern. Never copy-paste logic between files; extract to shared module.

---

## Part 4 — Validation

Every user input goes through **two independent validation layers**. Neither is optional.

### Layer 1 — Frontend (UX Guard)

Validates immediately, in the browser, before submission.

- Required fields — cannot submit blank
- Type constraints — numbers in number fields, email format, etc.
- Range constraints — min/max values shown clearly
- Resource constraints — cannot enter more than what is available
- Format constraints — phone format, date range, etc.
- Dependency constraints — if Field A is X, Field B must be Y

**UI pattern for constrained inputs:**
```
Available balance: ₱500.00          ← always show the constraint context
[  600  ] ← input                  ← input goes red immediately
⚠ Amount cannot exceed ₱500.00     ← inline error, not a toast
[ Transfer ] ← disabled            ← submit button disabled until valid
```

### Layer 2 — Backend (Security Guard)

Re-validates everything. Never trust client input.

- Same type/range/format rules as frontend
- Resource constraints fetched FRESH from the database at request time
- Ownership: authenticated user owns the resource being modified
- Race condition guard: DB transactions + row-level locking for financial ops
- Idempotency: prevent double-submission (unique request keys for payments)

```php
// CORRECT — query fresh from DB, inside a transaction
DB::transaction(function () use ($request) {
    $account = Account::lockForUpdate()->findOrFail($request->account_id);
    if ($request->amount > $account->balance) {
        throw new InsufficientBalanceException(
            "Amount {$request->amount} exceeds balance {$account->balance}"
        );
    }
    $account->decrement('balance', $request->amount);
});
```

### Resource Constraint Pattern: Show → Constrain → Guard → Lock

| Step | Layer | What Happens |
|---|---|---|
| Show | Frontend | Display the current limit to the user (balance, stock, seats) |
| Constrain | Frontend | Set max on input, disable submit when over limit, show inline error |
| Guard | Backend FormRequest | Re-validate the constraint from the DB before processing |
| Lock | Backend Service | Use DB transaction + lockForUpdate() to prevent race conditions |

**What "constraint" covers:**
- Financial: withdrawal ≤ balance, transfer ≤ account balance, refund ≤ original payment
- Inventory: order quantity ≤ stock on hand, reservation ≤ available units
- Capacity: booking ≤ remaining seats/slots/spots
- Quota: API calls ≤ plan limit, uploads ≤ storage quota
- Permissions: action allowed only if user has sufficient role/plan/credits

---

## Part 5 — Naming Conventions

| Context | Convention | Example |
|---|---|---|
| JS/TS variables & functions | camelCase | `userBalance`, `fetchStock()` |
| JS/TS component files | PascalCase | `ProductCard.vue`, `OrderForm.tsx` |
| JS/TS constants | SCREAMING_SNAKE | `MAX_UPLOAD_SIZE`, `API_TIMEOUT` |
| PHP variables | snake_case | `$account_balance`, `$created_at` |
| PHP classes & methods | PascalCase / camelCase | `OrderService`, `getAvailableStock()` |
| Python variables & functions | snake_case | `account_balance`, `fetch_stock()` |
| Python classes | PascalCase | `OrderService`, `ProductRepository` |
| DB columns & migrations | snake_case | `account_balance`, `created_at` |
| DB table names | snake_case, plural | `order_items`, `user_accounts` |
| API routes | kebab-case, plural nouns | `/api/order-items`, `/api/user-accounts` |
| Environment variables | SCREAMING_SNAKE | `DATABASE_URL`, `STRIPE_SECRET_KEY` |
| Git branches | kebab-case | `feature/stock-validation`, `fix/balance-overflow` |

---

## Part 6 — UI/UX Design Laws

These are not preferences. They are research-backed laws. Every screen must pass these.

### Fitts's Law — Touch targets must be large enough
- Minimum tap target: 44×44px (Apple HIG) / 48×48dp (Material)
- Primary actions get the largest, most accessible button on screen
- Destructive actions are smaller, lower contrast, and further from primary
- Never place two destructive actions adjacent to each other

### Hick's Law — Fewer choices = faster decisions
- Maximum 5–7 items in any navigation menu, dropdown, or selection list
- If more items are needed: group, paginate, or add search — never dump a raw list
- Forms: show only fields relevant to the current context
- For 5+ action items, use a Bottom Sheet grid instead of a stacked Speed Dial

### Jakob's Law — Use familiar patterns
- Standard patterns: nav on top or left, logo top-left, search top-right
- Form labels above inputs (not inside — placeholder text is not a label)
- Primary button on the right, Cancel/Back on the left
- Destructive confirmation dialogs before irreversible actions

### Miller's Law — Chunk information
- Group related fields with visible sections and headings
- Show no more than 7 (±2) items before paginating or collapsing
- Use visual separators (dividers, whitespace, cards) to chunk content

### Feedback Law — Every action must have a response
- Every button click → immediate visual response (loading spinner, disabled state)
- Every form submission → clear success or error message
- Every async operation → loading skeleton or progress indicator
- Never leave the user wondering if their action registered

### Error Prevention Law — Prevent before correcting
- Validate inline, in real-time, as the user types
- Show constraints upfront (e.g., "Max 500 characters" before they hit the limit)
- Confirm irreversible actions with a dialog
- Auto-format inputs where possible (phone, currency)

### Visibility of System Status
- Always show current state: loading, empty, error, success, partial
- Progress indicators for operations > 1 second
- Never show a blank screen — always skeleton or placeholder

---

## Part 7 — UI Design Standards

### Typography Scale

| Role | Weight | Desktop | Mobile |
|---|---|---|---|
| Page title / H1 | 700 Bold | 28–36px | 24px |
| Section heading / H2 | 600 SemiBold | 20–24px | 18px |
| Card title / H3 | 600 SemiBold | 16–18px | 16px |
| Body / default | 400 Regular | 14–16px | 14px |
| Secondary / caption | 400 Regular | 12–13px | 12px |
| Labels | 500 Medium | 13–14px | 13px |
| Numeric / data | 600–700, monospace | context-dependent | — |

- Use a single type scale — no arbitrary font sizes outside the scale
- Minimum body text: 14px
- Line height: body 1.5–1.6, headings 1.1–1.3
- Max line length: 65–75 characters
- Use modern sans-serif fonts (Inter, Roboto) with tight tracking for small uppercase text

### Spacing System (4px base grid)

```
 4px — xs   (tight, internal component padding)
 8px — sm   (between related elements)
12px — md-sm
16px — md   (standard section padding, card padding)
24px — lg   (between card groups)
32px — xl   (between page sections)
48px — 2xl  (major section breaks)
64px — 3xl  (hero spacing)
```

Never use arbitrary pixel values (e.g., `margin: 11px`). Snap to the grid.

### Color System — Semantic Tokens

Use these — not raw hex or Tailwind color names in components:

| Token | Purpose |
|---|---|
| `background` | Page background |
| `foreground` | Primary text |
| `muted` / `muted-foreground` | Secondary text, placeholders |
| `card` / `card-foreground` | Card surfaces |
| `primary` / `primary-foreground` | Primary action color |
| `secondary` / `secondary-foreground` | Secondary actions |
| `accent` / `accent-foreground` | Highlights, hover states |
| `destructive` / `destructive-foreground` | Delete, error, danger |
| `border` | Borders, dividers |
| `input` | Input borders |
| `ring` | Focus rings |

**Status Colors (consistent across entire app):**

| State | Semantic | Do Not Use |
|---|---|---|
| Success | Green (`green-600`) | Random greens per component |
| Warning | Amber (`amber-500`) | Yellow (too low contrast) |
| Error / Destructive | Red (`destructive` / `red-600`) | Pink, orange |
| Info | Blue (`blue-500`) | — |
| Neutral / Disabled | `muted-foreground` | Hardcoded gray |

**Contrast (WCAG AA — non-negotiable):**
- Normal text (< 18px): minimum 4.5:1 contrast ratio
- Large text (≥ 18px bold or ≥ 24px): minimum 3:1
- UI components and icons: minimum 3:1

**Dark Mode:**
- Every color class must have a `dark:` variant or use semantic tokens that adapt automatically
- Never hardcode raw colors like `text-gray-600` — use `text-muted-foreground`
- Test dark mode before marking any UI task complete

### Elevation & Depth

| Level | Use | Shadow |
|---|---|---|
| 0 | flat (background, page surfaces) | none |
| 1 | cards, sidebars | `shadow-sm` |
| 2 | dropdowns, popovers | `shadow-md` |
| 3 | modals, dialogs | `shadow-lg` + backdrop |
| 4 | toasts, overlays | `shadow-xl` + highest z-index |

**z-index Scale:**
```
Base content:     z-0
Sticky headers:   z-10
Dropdowns:        z-20
Sidebars:         z-30
Modals/Dialogs:   z-40
Toasts/Alerts:    z-50
```

Never use `z-[9999]` as a "fix" for layering bugs.

### Iconography
- Use a single icon library consistently (Lucide for EleFam)
- Icons paired with text: always left of text, same optical size
- Standalone icons: always include `aria-label` or tooltip
- Icon sizes: 16px (inline), 20px (buttons/list items), 24px (standalone actions)

---

## Part 8 — Mobile-First UI/UX (EleFam-Specific)

### Navigation & Context
- **Maintain user context**: Users must never lose their place for quick actions
- **Global Modals**: All creation flows (Wallet, Expense, Debt, Note, File, Deposit) via `useModalsStore`, rendered in `AppLayout.vue`
- **No route jumps for modals**: Open modals directly over current view

### Modal & Bottom Sheet Behavior
- Mobile modals slide up from the bottom (bottom sheet style)
- Account for safe areas: `pb-[env(safe-area-inset-bottom)]`, `pt-[env(safe-area-inset-top)]`
- Clear "X" close button + backdrop tap to dismiss
- Keyboard handling: inputs in sheets must not be covered by virtual keyboard
- Modals should never exceed `80vh` — user sees a sliver of background context
- Use `<Teleport to="body">` for all overlays to escape stacking context issues

### Visual Aesthetics
- Premium feel: soft shadows, blur effects (`backdrop-blur`), rounded corners (`rounded-2xl` / `rounded-3xl`)
- Glassmorphism on overlays, bottom nav, modal backgrounds (`bg-card/80 backdrop-blur-2xl`)
- Micro-interactions: `active:scale-90` on taps, smooth `transition-all duration-200`
- No harsh cuts — every state change must be animated with `ease-out` for enter, `ease-in` for exit
- Bottom sheets: `translate-y-full` to `translate-y-0`

### Financial Data UX
- **Transparency**: Always keep current balance visible during adjustments
- **Visual hierarchy**: Balance large and bold; minimize clutter in adjustment flows
- **Clear state changes**: Don't clear input abruptly without confirmation
- **Number formatting**: Accept raw numbers for input; display always formatted with commas and currency (`₱83,301.00`)

---

## Part 9 — Forms

### Anatomy of a Correct Form Field

```
[Label]                ← above input, not placeholder, always visible
[Input / Select]       ← clear border, focus ring, correct type attribute
[Helper text]          ← below input: constraint info, format hint (muted color)
[Inline error]         ← below input on validation failure (destructive color, icon)
[Constraint context]   ← show current resource limit near the relevant field
```

### Form Rules
- Labels always visible — placeholders are hints, not labels
- `type` attribute must match data: `type="number"` for numbers, `type="email"` for email, `type="tel"` for phone
- `autocomplete` attributes on login/registration forms
- Required fields: mark them — but don't mark every field with asterisk if all are required
- Tab order must follow visual reading order
- Submit on Enter key must work for single-input forms
- Disable submit button while request is in-flight
- Show loading indicator on submit button while processing
- After success: clear the form OR navigate away — never leave a submitted form in place

### Error Message Quality

| ❌ Bad | ✅ Good |
|---|---|
| "Invalid value" | "Amount must be between ₱1 and ₱500 (your available balance)" |
| "Error occurred" | "Could not complete transfer. Please try again." |
| "Required" | "Please enter the recipient's account number" |
| "Max exceeded" | "Quantity cannot exceed 50 (currently in stock)" |

---

## Part 10 — State Handling

Every screen that fetches data MUST implement all four states:

| State | What to Show |
|---|---|
| Loading | Skeleton placeholders matching the layout of the loaded content |
| Empty | Friendly message + call to action ("No orders yet — place your first order") |
| Error | Human error message + retry button (not a raw error object) |
| Data | The actual content |

- Use skeleton screens that match the shape of loaded content — not a generic spinner
- **Never**: blank white screen, raw `undefined` errors, infinite loading with no timeout

---

## Part 11 — API Response Contract

All endpoints must follow the same envelope:

```json
// Single resource — 200 OK
{ "data": { "id": 1, "name": "..." } }

// Collection — 200 OK
{ "data": [ {...}, {...} ] }

// Paginated — 200 OK
{ "data": [...], "meta": { "current_page": 1, "last_page": 4, "total": 58, "per_page": 15 } }

// Created — 201 Created
{ "data": { "id": 5, ... } }

// Deleted — 204 No Content
(no body)

// Validation error — 422
{ "message": "Validation failed.", "errors": { "amount": ["Amount exceeds available balance."] } }

// Auth error — 401
{ "message": "Unauthenticated." }

// Permission error — 403
{ "message": "You do not have permission to perform this action." }

// Not found — 404
{ "message": "Resource not found." }
```

- Always use an API serializer/resource layer — never return raw model objects
- HTTP status codes must be semantically correct
- Never expose stack traces, internal field names, or DB errors in production

---

## Part 12 — Security Baseline

- Input sanitization: strip or encode dangerous input before storing
- Mass assignment protection: whitelist fillable fields — never `$request->all()` into `create()`
- Authorization check: verify user owns or has permission for the resource
- Rate limiting: on auth, OTP, and message-sending endpoints
- Sensitive data: never log passwords, tokens, card numbers, or PII
- HTTPS only in production
- All secrets in `.env` — never committed to version control

---

## Part 13 — Performance Baseline

- **N+1 queries**: always eager-load relationships used in list views
- **Indexes**: every FK column and every WHERE-clause column must be indexed
- **Pagination**: never return unbounded lists — always paginate
- **Frontend**: lazy-load routes/pages, not loaded on initial bundle
- **Images**: compressed, WebP where supported, explicit width/height
- **API response time**: if > 500ms, needs caching or query optimization
- **PWA**: Service Worker uses `NetworkFirst` for API data, `CacheFirst` for static assets
- **Optimistic Updates**: always implement for instantaneous UX before API response
- **Lazy Loading**: destroy heavy components on modal unmount to save memory

---

## Part 14 — Debugging Workflow

When debugging, tracing errors, or investigating unexpected behavior, follow this structured
workflow. The goal is to find the **root cause** before applying any fix.

### Workflow: DETECT → LOCATE → READ → TEST → REPORT

### Step 0 — DETECT: Identify the Tech Stack

Scan for manifest files to determine language, framework, DB, test runner, and package manager:

| File Found | Stack Signal |
|---|---|
| `package.json` | Node.js — check for framework (Express, Next.js, NestJS) and test runner |
| `composer.json` | PHP — Laravel, Symfony |
| `requirements.txt` / `pyproject.toml` | Python — Django, Flask, FastAPI |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `tsconfig.json` | TypeScript |
| `docker-compose.yml` | Multi-service — reveals DB and services |
| `.env` / `.env.example` | Config keys reveal services in use |

### Step 1 — LOCATE: Find the Source

1. Read the error message / stack trace — find the first frame in *user code*
2. If no error: ask for expected vs. actual behavior
3. Search for the relevant symbol using grep
4. Identify the exact file and line
5. Do NOT assume the bug is where the crash surfaces — it often originates upstream

### Step 2 — READ: Read All Connected Files

| Type | What to Look For |
|---|---|
| Origin file | The broken function/class/route |
| Imported modules | All local imports |
| Config files | `.env`, framework config |
| Schema/models | Database models referenced |
| Middleware | Auth, validation wrappers on the broken path |
| Tests | Existing unit/integration tests |
| Callers | Files that call the broken function (1 level up) |

### Step 3 — TEST: Verify the Bug

Use the correct test runner for the detected stack:

| Stack | Test Command |
|---|---|
| PHP / PHPUnit | `./vendor/bin/phpunit tests/BrokenTest.php --verbose` |
| Node.js / Vitest | `npx vitest run tests/broken.test.ts` |
| Node.js / Jest | `npx jest tests/broken.test.js --verbose` |
| Python / pytest | `pytest tests/test_target.py -v --tb=long` |

If no test exists, write a minimal reproduction or use `curl` for API endpoints.

### Step 4 — REPORT: Produce Bug Audit

```
## Bug Audit Report

**Stack**: [detected]
**Problem**: [observed vs. expected]
**Root Cause**: [file, line, function, WHY it's broken]
**Test Results**: [what was tested, pass/fail]
**Recommended Fix**: [specific change, file, line, reasoning]
**Complexity**: [Low / Medium / High]
**Regression Risk**: [Low / Medium / High]
**Files Inspected**: [full list]
```

### Debugging Edge Cases
- **Monorepo**: Detect stack for the *service containing the bug*, not the whole repo
- **No error given**: Ask for reproduction steps first — do not guess
- **Bug not reproducible**: Document in report; test under multiple conditions
- **Multiple bugs found**: One report per root cause
- **Third-party bug**: Trace to the user code that *calls* the library

---

## Part 15 — Deployment & Versioning (EleFam-Specific)

### Mandatory Version Bumps

After completing a task or preparing a commit for deployment:
1. Update the version string in `frontend/src/views/Settings.vue`
2. **Increment Rule**: Always increment the last number (patch version)
   - `v1.2.0` → `v1.2.1`
   - `v1.2.9` → `v1.3.0` (roll over to 0, increment minor)

This ensures users can track when their device has downloaded the latest PWA update.

---

## Part 16 — Pre-Commit Checklist

### Architecture
- [ ] Controller is thin — business logic in Service
- [ ] No DB queries in Controller — in Repository
- [ ] No API calls in components/views — in Store
- [ ] No duplicated code — extracted to shared module

### Validation
- [ ] Frontend: required, type, range, format constraints on all inputs
- [ ] Frontend: resource constraint shown and enforced (balance, stock, quota)
- [ ] Frontend: submit disabled while over constraint or during in-flight request
- [ ] Backend: FormRequest validates shape and types
- [ ] Backend: Service validates resource constraint from fresh DB query
- [ ] Backend: financial/stock operations in DB transaction with row lock

### UX / State
- [ ] Loading state: skeleton implemented
- [ ] Empty state: friendly message + CTA
- [ ] Error state: human message + retry
- [ ] Every action has immediate visual feedback
- [ ] Destructive actions have confirmation dialog

### UI / Design
- [ ] Semantic color tokens used (not raw hex)
- [ ] `dark:` variants applied to all color-sensitive classes
- [ ] Spacing follows 4px grid
- [ ] Touch targets ≥ 44px
- [ ] Contrast ratio meets WCAG AA (4.5:1 for text)
- [ ] Single icon library (Lucide) used consistently
- [ ] Typography follows type scale

### Forms
- [ ] Labels above inputs (not placeholders only)
- [ ] `type` attribute matches data type
- [ ] Inline error messages are specific and actionable
- [ ] Constraint context visible near constrained fields

### API
- [ ] Consistent response envelope
- [ ] Correct HTTP status codes
- [ ] No stack traces or internal errors exposed in production
- [ ] Authorization checked (not just authentication)

### Security
- [ ] No `$request->all()` passed to create/update
- [ ] Rate limiting on auth and sensitive endpoints
- [ ] No secrets hardcoded or committed

### Perform
ance
- [ ] Relationships eager-loaded in list views
- [ ] Paginated, not unbounded list returns
- [ ] Routes/pages lazy-loaded on frontend
- [ ] Dark mode tested
- [ ] Version bumped in Settings.vue
