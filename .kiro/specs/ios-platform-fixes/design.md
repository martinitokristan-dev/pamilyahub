# Design: iOS Platform Fixes (Green Screen & Offline Mode)

**Status:** Draft  
**Created:** 2025-01-XX  
**Updated:** 2025-01-XX

---

## Overview

This design addresses two iOS-specific issues:
1. **Green screen video background visible on iOS** - The CSS SVG filter approach for green screen removal works inconsistently across browsers (Android Chrome vs iOS Safari)
2. **Offline mode not working on iOS** - The PWA service worker is not being registered properly on iOS Safari

## Problem Analysis

### Issue 1: Green Screen Rendering

**Current Implementation:**
- Dashboard.vue uses a CSS SVG filter (`filter: url(#green-screen)`) with a color matrix
- Works on Android Chrome but fails on iOS Safari/WebKit
- SVG filter browser compatibility is inconsistent

**Root Cause:**
- iOS Safari has different rendering behavior for SVG color matrix filters
- WebKit's implementation doesn't properly handle the green channel suppression in the filter

**Available Solution:**
- `TransparentVideo.vue` component already exists with canvas-based green screen removal
- Uses pixel manipulation with `getImageData()` and `putImageData()`
- Cross-platform compatible (works on both Android and iOS)
- Currently unused in Dashboard.vue

### Issue 2: iOS Offline Mode

**Current Implementation:**
- Service worker configured in `vite.config.js` with `injectManifest` strategy
- `useRegisterSW` hook used in AppLayout.vue
- SW registration includes periodic update checks (every 1 minute)

**Potential Root Causes:**
1. **iOS Safari PWA Scope Issue** - iOS requires `start_url` and `scope` to match exactly
2. **Service Worker Registration Timing** - iOS may require SW registration before DOM load
3. **Localhost SW Clearing** - AppLayout.vue unregisters all SWs on localhost, which may affect testing
4. **Cache Strategy** - `NetworkFirst` for API calls may not properly fall back on iOS

**iOS-Specific Requirements:**
- Service worker must be served from same origin
- HTTPS required (except localhost)
- `scope` must match or be parent of `start_url`
- iOS 11.3+ required for SW support
- iOS may require explicit user interaction before SW registration

## Proposed Solution

### Fix 1: Replace CSS Filter with Canvas Component

**Implementation:**
1. Replace the current video implementation in Dashboard.vue
2. Use the existing `TransparentVideo.vue` component
3. Remove the SVG filter definition
4. Update styling to match current design

**Changes Required:**
- `frontend/src/views/Dashboard.vue`:
  - Import `TransparentVideo` component
  - Replace `<video>` element with `<TransparentVideo>`
  - Remove SVG filter definition
  - Adjust component props and styling

**Benefits:**
- Consistent rendering across all platforms
- Already tested and optimized (150px processing width)
- Handles frame-by-frame processing efficiently
- Better green screen removal algorithm

### Fix 2: iOS Service Worker Registration Improvements

**Implementation:**
1. Update manifest.webmanifest with explicit `start_url` and `scope`
2. Add iOS-specific meta tags to index.html
3. Improve SW registration error handling
4. Add iOS detection and fallback behavior
5. Update cache strategies for better iOS compatibility

**Changes Required:**

**A. Manifest Updates** (`vite.config.js`):
```javascript
manifest: {
  // ... existing fields
  start_url: '/',
  scope: '/',
  // Add iOS-specific icons
  icons: [
    // ... existing icons
    {
      src: '/icons/wallets/EF-logo-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/icons/wallets/EF-logo-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
    }
  ]
}
```

**B. Index.html Updates**:
```html
<!-- iOS PWA meta tags -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="EleFam">
<link rel="apple-touch-icon" href="/icons/wallets/EF-logo-192.png">
```

**C. AppLayout.vue Updates**:
- Add iOS detection utility
- Improve SW registration error handling
- Add fallback for iOS-specific issues
- Log registration status for debugging

**D. Service Worker Updates** (`sw.js`):
- Ensure proper iOS cache handling
- Add explicit offline fallback page
- Improve `NetworkFirst` strategy timeout for iOS
- Add better error messages for debugging

## Technical Specifications

### Component API

**TransparentVideo.vue** (existing):
```vue
<TransparentVideo 
  src="/icons/wallets/elefam_greenscreen.mp4"
  :tolerance="25"
  video-class="w-[110%] max-w-none h-auto object-cover -translate-y-[5%]"
/>
```

### Service Worker Strategy

**Current:**
- NetworkFirst with 3s timeout
- Falls back to cache if network fails

**Improved for iOS:**
- Detect iOS and adjust timeout to 5s
- Add explicit offline fallback
- Better error handling for iOS quirks
- Add SW registration status logging

### Browser Compatibility

| Feature | Android Chrome | iOS Safari | Status |
|---------|---------------|------------|--------|
| Canvas Green Screen | ✅ Works | ✅ Works | Current |
| SVG Filter Green Screen | ✅ Works | ❌ Fails | Remove |
| Service Worker | ✅ Works | ⚠️ Partial | Fix |
| IndexedDB | ✅ Works | ✅ Works | OK |

## Implementation Plan

### Phase 1: Green Screen Fix (High Priority)
1. Update Dashboard.vue to use TransparentVideo component
2. Remove SVG filter code
3. Test on both Android and iOS

### Phase 2: Offline Mode Fix (High Priority)
1. Update vite.config.js manifest
2. Add iOS meta tags to index.html
3. Improve SW registration in AppLayout.vue
4. Update service worker for iOS compatibility
5. Add debugging/logging for SW registration
6. Test on iOS Safari (both standalone and browser)

## Testing Strategy

### Green Screen Testing
- [ ] Test on iOS Safari (browser mode)
- [ ] Test on iOS Safari (standalone PWA mode)
- [ ] Test on Android Chrome (browser mode)
- [ ] Test on Android Chrome (standalone PWA mode)
- [ ] Verify video plays automatically
- [ ] Verify green background is fully transparent
- [ ] Check performance (frame rate, CPU usage)

### Offline Mode Testing
- [ ] Test SW registration on iOS Safari
- [ ] Test SW registration on Android Chrome
- [ ] Test offline behavior (airplane mode)
- [ ] Test cache-first strategies (images, fonts)
- [ ] Test network-first strategies (API calls)
- [ ] Verify proper fallback to cached data
- [ ] Check SW update mechanism
- [ ] Verify IndexedDB sync still works

## Risks & Mitigation

### Risk 1: Canvas Performance on Low-End Devices
**Impact:** Medium  
**Mitigation:** TransparentVideo already optimized with 150px processing width

### Risk 2: iOS Service Worker Still Fails
**Impact:** High  
**Mitigation:** 
- Add comprehensive logging
- Implement feature detection
- Provide graceful degradation
- Document iOS version requirements

### Risk 3: Breaking Android Functionality
**Impact:** High  
**Mitigation:**
- Test thoroughly on both platforms
- Use feature detection, not browser detection
- Maintain backward compatibility

## Success Criteria

1. **Green screen is transparent on both iOS and Android**
2. **Video plays automatically on both platforms**
3. **Offline mode works on iOS Safari** (cache fallback active)
4. **No regression on Android Chrome**
5. **Performance remains acceptable** (smooth video, fast API response)

## Open Questions

1. Should we keep the SVG filter as a fallback, or completely remove it?
   - **Recommendation:** Remove completely, canvas approach is more reliable
   
2. Should we add a visual indicator when the app is in offline mode?
   - **Note:** `OfflineBanner.vue` already exists and is used in AppLayout.vue
   
3. What iOS version should we target as minimum?
   - **Recommendation:** iOS 12+ (first with stable PWA support)

4. Should we add analytics to track SW registration success/failure?
   - **Recommendation:** Add console logging for now, consider analytics later

## References

- [iOS PWA Support](https://firt.dev/notes/pwa-ios/)
- [Service Worker on iOS](https://webkit.org/blog/8090/workers-at-your-service/)
- [Canvas Green Screen Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas)
- [Workbox Strategies](https://developers.google.com/web/tools/workbox/modules/workbox-strategies)
