# Tasks: iOS Platform Fixes

**Spec Path:** `d:\PamilyaHub\.kiro\specs\ios-platform-fixes`  
**Status:** Not Started  
**Created:** 2025-01-XX

---

## Task 1: Replace CSS Filter with Canvas Component in Dashboard
**ID:** `ios-fix-task-1`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 30 minutes  
**Dependencies:** None

**Description:**
Replace the current SVG filter-based green screen removal with the canvas-based `TransparentVideo` component in Dashboard.vue.

**Sub-tasks:**
1. Import `TransparentVideo` component in Dashboard.vue
2. Replace the `<video>` element with `<TransparentVideo>` component
3. Pass correct props (src, tolerance, videoClass)
4. Remove the SVG filter definition from template
5. Remove `mascotVideoRef`, `playMascotVideo()`, and `resumeMascotVideo()` functions (no longer needed)
6. Remove video-related event listeners and lifecycle hooks
7. Test video rendering on desktop browser

**Files to Modify:**
- `frontend/src/views/Dashboard.vue`

**Acceptance Criteria:**
- TransparentVideo component is imported and used
- Video displays with transparent green background
- Video maintains same size and position as before
- All video-related refs and functions cleaned up
- No console errors
- Video plays automatically

**Testing:**
```bash
# Start dev server
cd frontend
npm run dev
# Navigate to dashboard and verify video displays correctly
```

---

## Task 2: Update PWA Manifest for iOS Compatibility
**ID:** `ios-fix-task-2`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 15 minutes  
**Dependencies:** None

**Description:**
Update the PWA manifest configuration in vite.config.js to meet iOS requirements.

**Sub-tasks:**
1. Add explicit `start_url: '/'` to manifest
2. Add explicit `scope: '/'` to manifest
3. Verify icon configuration for iOS
4. Ensure `purpose: 'maskable'` is set for 512x512 icon
5. Verify `display: 'standalone'` is set

**Files to Modify:**
- `frontend/vite.config.js`

**Current Configuration:**
```javascript
manifest: {
  name: 'EleFam',
  short_name: 'EleFam',
  description: 'Personal family expenses tracker',
  theme_color: '#5610c9',
  background_color: '#5610c9',
  display: 'standalone',
  icons: [...]
}
```

**Updated Configuration:**
```javascript
manifest: {
  name: 'EleFam',
  short_name: 'EleFam',
  description: 'Personal family expenses tracker',
  theme_color: '#5610c9',
  background_color: '#5610c9',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [...]
}
```

**Acceptance Criteria:**
- `start_url` and `scope` are explicitly set
- Icon purposes are correct for iOS
- Manifest validates without errors
- No breaking changes to existing manifest

---

## Task 3: Add iOS PWA Meta Tags to index.html
**ID:** `ios-fix-task-3`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 10 minutes  
**Dependencies:** None

**Description:**
Add iOS-specific meta tags to index.html for proper PWA support on iOS Safari.

**Sub-tasks:**
1. Add `apple-mobile-web-app-capable` meta tag
2. Add `apple-mobile-web-app-status-bar-style` meta tag
3. Add `apple-mobile-web-app-title` meta tag
4. Add `apple-touch-icon` link tag
5. Verify existing viewport and theme-color meta tags

**Files to Modify:**
- `frontend/index.html`

**Meta Tags to Add:**
```html
<!-- iOS PWA Support -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="EleFam">
<link rel="apple-touch-icon" href="/icons/wallets/EF-logo-192.png">
```

**Acceptance Criteria:**
- All iOS meta tags are present in `<head>`
- apple-touch-icon points to correct icon file
- No duplicate meta tags
- HTML validates correctly

---

## Task 4: Improve Service Worker Registration in AppLayout
**ID:** `ios-fix-task-4`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 30 minutes  
**Dependencies:** None

**Description:**
Enhance service worker registration in AppLayout.vue with better error handling, iOS detection, and logging for debugging.

**Sub-tasks:**
1. Add iOS detection utility function
2. Add detailed logging for SW registration events
3. Improve error handling in `onRegisteredSW` callback
4. Add logging for SW update checks
5. Add fallback behavior if SW registration fails
6. Consider adjusting update check interval based on platform
7. Add registration success/failure state tracking

**Files to Modify:**
- `frontend/src/layouts/AppLayout.vue`

**iOS Detection Utility:**
```javascript
const isIOS = () => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
```

**Enhanced Registration:**
```javascript
const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW({
  immediate: true, // Register immediately
  onRegisteredSW(swUrl, registration) {
    console.log('[SW] Service worker registered:', swUrl)
    console.log('[SW] Platform:', isIOS() ? 'iOS' : 'Other')
    
    if (registration) {
      const updateInterval = isIOS() ? 2 * 60 * 1000 : 1 * 60 * 1000
      setInterval(() => {
        console.log('[SW] Checking for updates...')
        registration.update()
      }, updateInterval)
    }
  },
  onRegisterError(error) {
    console.error('[SW] Registration failed:', error)
  }
})
```

**Acceptance Criteria:**
- iOS detection function is implemented
- Comprehensive logging for all SW events
- Error handling for registration failures
- No breaking changes to existing functionality
- Logs are helpful for debugging iOS issues

---

## Task 5: Enhance Service Worker Cache Strategies for iOS
**ID:** `ios-fix-task-5`  
**Status:** not_started  
**Priority:** Medium  
**Estimated Effort:** 30 minutes  
**Dependencies:** None

**Description:**
Update service worker cache strategies in sw.js to better handle iOS Safari's specific behavior and constraints.

**Sub-tasks:**
1. Increase NetworkFirst timeout from 3s to 5s
2. Add iOS-specific cache configuration comments
3. Verify cache size limits are appropriate for iOS
4. Add fallback handling for offline mode
5. Ensure proper error handling in cache strategies
6. Add logging for cache hits/misses (development only)

**Files to Modify:**
- `frontend/src/sw.js`

**Current NetworkFirst Strategy:**
```javascript
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [...]
  })
)
```

**Updated Strategy:**
```javascript
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5, // Increased for iOS
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
)
```

**Acceptance Criteria:**
- NetworkFirst timeout increased to 5s
- Cache strategies handle iOS constraints
- Proper error handling for cache operations
- No breaking changes to existing cache behavior
- Cache limits are appropriate for mobile devices

---

## Task 6: Test Green Screen Fix on iOS Device
**ID:** `ios-fix-task-6`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 20 minutes  
**Dependencies:** `ios-fix-task-1`

**Description:**
Test the canvas-based green screen removal on actual iOS devices to verify the fix works correctly.

**Sub-tasks:**
1. Build production version of the app
2. Deploy to test environment or run local HTTPS server
3. Test on iOS Safari (browser mode)
4. Test on iOS Safari (PWA/standalone mode)
5. Verify green background is transparent
6. Check video performance (frame rate, smoothness)
7. Test on multiple iOS versions if possible (iOS 12+)

**Testing Checklist:**
- [~] Video loads automatically
- [~] Green background is completely transparent
- [~] Video plays smoothly at 30fps+
- [~] No visual glitches or artifacts
- [~] Mascot position is correct
- [~] Chat bubble alignment is correct
- [~] Memory usage is acceptable
- [~] No console errors

**Testing Commands:**
```bash
cd frontend
npm run build
# Deploy or use: npx http-server dist -p 8080 --ssl
```

**Acceptance Criteria:**
- Green screen is transparent on iOS Safari (browser)
- Green screen is transparent on iOS Safari (PWA)
- Video plays smoothly without stuttering
- No performance issues on iOS devices
- Visual appearance matches Android

---

## Task 7: Test Offline Mode on iOS Device
**ID:** `ios-fix-task-7`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 30 minutes  
**Dependencies:** `ios-fix-task-2`, `ios-fix-task-3`, `ios-fix-task-4`, `ios-fix-task-5`

**Description:**
Test service worker registration and offline functionality on actual iOS devices to verify the fix works correctly.

**Sub-tasks:**
1. Clear all caches and service workers
2. Visit app on iOS Safari (first time - should register SW)
3. Check browser console for SW registration logs
4. Verify app can be added to home screen
5. Enable airplane mode
6. Open app in offline mode
7. Test cached content loads correctly
8. Test offline banner displays
9. Add new expense offline (should queue in IndexedDB)
10. Re-enable network and verify sync works

**Testing Checklist:**
- [~] Service worker registers successfully (check console logs)
- [~] App installs to home screen correctly
- [~] App opens in standalone mode
- [~] Offline mode works (cached content loads)
- [~] Offline banner displays when offline
- [~] Can view expenses, wallets, notes offline
- [~] Can add new expense offline
- [~] Changes sync when back online
- [~] No console errors during offline/online transitions

**iOS Specific Checks:**
- [~] Check iOS version (12+)
- [~] Verify HTTPS connection
- [~] Check Storage & Cache settings in iOS
- [~] Verify service worker shows in Safari Developer Tools

**Debugging Commands:**
```javascript
// In iOS Safari console:
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs))
navigator.serviceWorker.controller && console.log('SW active')
```

**Acceptance Criteria:**
- Service worker registers on iOS Safari
- Offline mode works (cached content accessible)
- Data syncs correctly when back online
- Offline banner appears/disappears correctly
- No errors in console
- App behavior matches Android

---

## Task 8: Test on Android to Ensure No Regressions
**ID:** `ios-fix-task-8`  
**Status:** not_started  
**Priority:** High  
**Estimated Effort:** 20 minutes  
**Dependencies:** `ios-fix-task-1`, `ios-fix-task-2`, `ios-fix-task-3`, `ios-fix-task-4`, `ios-fix-task-5`

**Description:**
Verify that all changes work correctly on Android and no regressions were introduced.

**Sub-tasks:**
1. Test green screen video on Android Chrome
2. Test service worker registration on Android
3. Test offline mode on Android
4. Compare behavior with previous version
5. Verify no performance regressions

**Testing Checklist:**
- [~] Green screen is transparent on Android (browser)
- [~] Green screen is transparent on Android (PWA)
- [~] Video plays smoothly
- [~] Service worker registers correctly
- [~] Offline mode works
- [~] No new console errors
- [~] Performance is same or better

**Acceptance Criteria:**
- All functionality works on Android Chrome
- No regressions from previous version
- Green screen removal works correctly
- Offline mode continues to work
- Service worker registers and updates correctly

---

## Task 9: Update Documentation and Add Comments
**ID:** `ios-fix-task-9`  
**Status:** not_started  
**Priority:** Low  
**Estimated Effort:** 15 minutes  
**Dependencies:** All previous tasks

**Description:**
Document the changes made, add inline comments for iOS-specific code, and update any relevant documentation.

**Sub-tasks:**
1. Add comments explaining iOS-specific code
2. Document iOS requirements in code comments
3. Update README if needed (iOS compatibility notes)
4. Add troubleshooting section for iOS issues
5. Document minimum iOS version requirements

**Files to Update:**
- Code comments in modified files
- README.md (if needed)
- Any developer documentation

**Acceptance Criteria:**
- All iOS-specific code has explanatory comments
- Complex logic is well-documented
- README mentions iOS compatibility
- Troubleshooting guide available for iOS issues

---

## Summary

**Total Tasks:** 9  
**High Priority:** 6 tasks  
**Medium Priority:** 1 task  
**Low Priority:** 2 tasks  
**Estimated Total Effort:** ~3-4 hours

**Critical Path:**
1. Task 1 → Task 6 (Green screen fix)
2. Tasks 2, 3, 4, 5 → Task 7 (Offline mode fix)
3. Task 8 (Regression testing)
4. Task 9 (Documentation)

**Dependencies Graph:**
```
Task 1 ─────────────────────► Task 6
                                  │
Task 2 ──┐                        │
Task 3 ──┼─► Task 7 ──────────────┼─► Task 8 ─► Task 9
Task 4 ──┤                        │
Task 5 ──┘                        │
                                  │
         (All tasks converge) ────┘
```
