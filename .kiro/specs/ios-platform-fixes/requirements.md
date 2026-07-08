# Requirements: iOS Platform Fixes

**Status:** Draft  
**Priority:** High  
**Target Platforms:** iOS Safari, Android Chrome  

---

## Business Requirements

### BR-1: Cross-Platform Visual Consistency
**Priority:** High  
**Description:** The EleFam mascot video must display identically on both iOS and Android devices, with the green background completely transparent.

**Acceptance Criteria:**
- Green background is fully transparent on iOS Safari (browser mode)
- Green background is fully transparent on iOS Safari (PWA mode)
- Green background remains transparent on Android Chrome
- Video plays automatically without user interaction
- No visual glitches or artifacts during video playback

**Rationale:** Brand consistency and professional appearance across all platforms.

---

### BR-2: iOS Offline Functionality
**Priority:** High  
**Description:** Users on iOS devices must be able to use the app in offline mode, with proper caching and data persistence.

**Acceptance Criteria:**
- Service worker registers successfully on iOS Safari
- App loads and displays cached content when offline
- User can view previously loaded data (expenses, wallets, notes)
- Offline banner displays when network is unavailable
- App syncs changes when connection is restored
- IndexedDB continues to work for local data storage

**Rationale:** Users need reliable access to their financial data regardless of network connectivity, especially on iOS devices.

---

## Functional Requirements

### FR-1: Canvas-Based Green Screen Removal
**Priority:** High  
**Description:** Replace CSS SVG filter with canvas-based green screen removal using the existing TransparentVideo component.

**Technical Details:**
- Use `TransparentVideo.vue` component in Dashboard.vue
- Remove SVG filter definition from template
- Maintain current video size and positioning
- Preserve all video attributes (autoplay, loop, muted, playsinline)

**Dependencies:**
- TransparentVideo.vue component (already exists)

---

### FR-2: iOS-Compatible Service Worker Registration
**Priority:** High  
**Description:** Update service worker configuration and registration to be fully compatible with iOS Safari requirements.

**Technical Details:**
- Add explicit `start_url` and `scope` to manifest
- Include iOS-specific meta tags in index.html
- Add proper apple-touch-icon references
- Improve SW registration error handling
- Add logging for debugging registration issues

**Dependencies:**
- vite-plugin-pwa
- Workbox libraries

---

### FR-3: iOS PWA Manifest Configuration
**Priority:** Medium  
**Description:** Ensure PWA manifest meets all iOS requirements for standalone app mode.

**Technical Details:**
- Verify `display: standalone` is set
- Ensure proper icon sizes (192x192, 512x512)
- Set `purpose: maskable` for iOS icons
- Define `theme_color` and `background_color`
- Set proper `scope` and `start_url`

---

### FR-4: Enhanced Cache Strategies for iOS
**Priority:** Medium  
**Description:** Optimize Workbox cache strategies for iOS Safari's specific behavior.

**Technical Details:**
- Increase NetworkFirst timeout from 3s to 5s for iOS
- Add explicit offline fallback page
- Ensure CacheFirst strategies work for images and fonts
- Add proper cache expiration policies
- Handle iOS-specific cache storage limits

---

## Non-Functional Requirements

### NFR-1: Performance
**Description:** Video processing must not impact app performance.

**Acceptance Criteria:**
- Video plays at 30fps or higher
- Canvas processing does not block main thread
- Memory usage stays below 50MB for video processing
- No frame drops during video playback

---

### NFR-2: Browser Compatibility
**Description:** Solution must work across all supported platforms.

**Supported Platforms:**
- iOS Safari 12+ (browser and PWA mode)
- Android Chrome 80+
- Desktop browsers (Chrome, Firefox, Safari, Edge)

---

### NFR-3: Graceful Degradation
**Description:** If service worker registration fails, app should still function.

**Acceptance Criteria:**
- App loads and works without service worker
- User can still access online functionality
- Appropriate message shown if offline mode unavailable
- No console errors or broken functionality

---

### NFR-4: Maintainability
**Description:** Code should be clean, documented, and maintainable.

**Acceptance Criteria:**
- All changes include inline comments
- Complex logic is documented
- No duplicate code
- Follow existing code style and patterns

---

## Technical Constraints

### TC-1: iOS PWA Limitations
- iOS requires HTTPS for service workers (except localhost)
- iOS has storage quota limits (50MB for service worker cache)
- iOS may clear caches aggressively when storage is low
- iOS requires user to manually add app to home screen

---

### TC-2: Browser API Compatibility
- Canvas API support required for green screen removal
- Service Worker API support required for offline mode
- IndexedDB support required for data persistence
- Push API may have limited support on iOS

---

## User Stories

### US-1: iOS User Views Dashboard
**As an** iOS user  
**I want to** see the EleFam mascot without a green background  
**So that** the app looks professional and polished on my device

**Acceptance Criteria:**
- Green background is completely transparent
- Video plays smoothly without stuttering
- Mascot appears correctly positioned in the UI

---

### US-2: iOS User Works Offline
**As an** iOS user  
**I want to** use the app when I have no internet connection  
**So that** I can track expenses even when offline

**Acceptance Criteria:**
- App loads when offline (after initial online visit)
- I can view my existing expenses, wallets, and notes
- I can add new expenses that will sync later
- I see a banner indicating offline status
- Changes sync automatically when connection is restored

---

### US-3: iOS User Receives Updates
**As an** iOS user  
**I want to** receive app updates automatically  
**So that** I always have the latest features and bug fixes

**Acceptance Criteria:**
- Service worker detects updates
- Notification appears when update is available
- App updates and reloads smoothly
- No data loss during update process

---

## Out of Scope

The following items are explicitly out of scope for this specification:

1. **Android-specific fixes** - Current Android functionality works correctly
2. **Offline data editing conflicts** - Sync conflict resolution is handled by existing syncEngine.js
3. **Push notifications on iOS** - Different issue, handled separately
4. **Video content changes** - Only addressing rendering, not video content itself
5. **Desktop PWA support** - Focus is on mobile platforms (iOS/Android)

---

## Success Metrics

### Primary Metrics
1. **Green screen removal success rate:** 100% on iOS Safari
2. **Service worker registration rate:** >95% on iOS devices
3. **Offline mode functionality:** 100% when SW is registered
4. **Zero regressions:** Android functionality unchanged

### Secondary Metrics
1. **Video frame rate:** Maintain 30fps or higher
2. **SW registration time:** <2 seconds on average
3. **Cache hit rate:** >80% for offline requests
4. **User-reported issues:** Decrease by 100% for these two specific issues

---

## Dependencies

### External Dependencies
- `vite-plugin-pwa` - PWA manifest and SW generation
- `workbox-precaching` - Asset precaching
- `workbox-routing` - Request routing
- `workbox-strategies` - Cache strategies

### Internal Dependencies
- `TransparentVideo.vue` - Canvas-based green screen removal
- `OfflineBanner.vue` - Offline status indicator
- `syncEngine.js` - Offline data synchronization
- `offlineDb.js` - IndexedDB management

---

## Assumptions

1. Users have iOS 12+ or Android Chrome 80+
2. Users have sufficient device storage for caching
3. Users have granted necessary permissions for PWA
4. Initial app visit requires internet connection
5. Video file (elefam_greenscreen.mp4) is properly formatted

---

## Risks

### High Risk
- **iOS service worker may still not register** due to iOS-specific quirks
  - Mitigation: Add comprehensive logging, feature detection, graceful fallback

### Medium Risk
- **Canvas processing may impact low-end device performance**
  - Mitigation: TransparentVideo already optimized to 150px processing width

### Low Risk
- **Breaking Android functionality during fixes**
  - Mitigation: Thorough testing on both platforms, feature detection

---

## Questions & Decisions

### Q1: Should we remove SVG filter completely or keep as fallback?
**Decision:** Remove completely. Canvas approach is more reliable and already proven to work.

### Q2: What iOS version should we support?
**Decision:** iOS 12+ (first version with stable PWA/SW support)

### Q3: Should we add analytics for SW registration failures?
**Decision:** Add console logging for debugging. Consider analytics in future iteration.

### Q4: Should we add visual feedback during video loading?
**Decision:** Out of scope. Video loads quickly enough, and TransparentVideo handles this internally.

---

## Acceptance Criteria Summary

**This specification is considered complete when:**

1. ✅ Green screen is transparent on iOS Safari (browser and PWA)
2. ✅ Green screen remains transparent on Android Chrome
3. ✅ Service worker registers successfully on iOS Safari
4. ✅ Offline mode works on iOS (cached content accessible)
5. ✅ All existing functionality remains working on Android
6. ✅ No performance regressions (video plays smoothly)
7. ✅ Proper error handling and logging implemented
8. ✅ All tests pass on both platforms
