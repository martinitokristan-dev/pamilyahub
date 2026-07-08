# iOS Platform Fixes Specification

**Created:** 2025-01-XX  
**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Effort:** 3-4 hours

---

## Quick Summary

This specification addresses two critical iOS-specific issues:

1. **Green Screen Video Background Visible on iOS** 
   - CSS SVG filter doesn't work on iOS Safari
   - Solution: Replace with canvas-based green screen removal using existing `TransparentVideo` component

2. **Offline Mode Not Working on iOS**
   - Service worker registration has iOS-specific requirements
   - Solution: Update PWA manifest, add iOS meta tags, improve SW registration

---

## Problem Statement

### Issue 1: Green Screen Rendering
The EleFam mascot video (`elefam_greenscreen.mp4`) displays correctly on Android Chrome with a transparent green background, but on iOS Safari the green background is visible. This is due to inconsistent browser support for CSS SVG color matrix filters.

**Current Implementation:** CSS filter with SVG color matrix  
**Root Cause:** iOS Safari/WebKit handles filters differently than Chrome  
**Solution:** Use canvas-based pixel manipulation (TransparentVideo.vue)

### Issue 2: iOS Offline Mode
The PWA works offline on Android but not on iOS Safari. Users see "Safari can't open the page because your iPhone is not connected to the internet" when trying to use the app offline.

**Current Implementation:** Service worker with vite-plugin-pwa  
**Root Cause:** iOS requires specific PWA configuration (start_url, scope, meta tags)  
**Solution:** Add iOS-specific manifest configuration and meta tags

---

## Solution Overview

### Fix 1: Canvas-Based Green Screen Removal
- Replace `<video>` element with `<TransparentVideo>` component in Dashboard.vue
- Remove SVG filter code
- Use existing, proven canvas-based green screen algorithm
- Works consistently across all browsers

### Fix 2: iOS Service Worker Compatibility
- Add explicit `start_url` and `scope` to PWA manifest
- Add iOS-specific meta tags to index.html
- Enhance SW registration with iOS detection and logging
- Increase cache timeout for iOS network conditions
- Comprehensive error handling and debugging

---

## Files to be Modified

### Frontend Files
1. **`frontend/src/views/Dashboard.vue`** - Replace video implementation
2. **`frontend/vite.config.js`** - Update PWA manifest
3. **`frontend/index.html`** - Add iOS meta tags
4. **`frontend/src/layouts/AppLayout.vue`** - Improve SW registration
5. **`frontend/src/sw.js`** - Enhance cache strategies

### No Backend Changes Required

---

## Testing Requirements

### Green Screen Testing
- [ ] iOS Safari (browser mode)
- [ ] iOS Safari (PWA/standalone mode)
- [ ] Android Chrome (browser mode)
- [ ] Android Chrome (PWA mode)
- [ ] Desktop browsers (Chrome, Firefox, Safari)

### Offline Mode Testing
- [ ] Service worker registration on iOS
- [ ] Service worker registration on Android
- [ ] Offline functionality (airplane mode)
- [ ] Cache strategies (images, fonts, API calls)
- [ ] Data sync after coming back online
- [ ] SW update mechanism

### Performance Testing
- [ ] Video frame rate (30fps+)
- [ ] Memory usage (<50MB for video)
- [ ] No frame drops
- [ ] Fast SW registration (<2s)

---

## Success Criteria

✅ Green screen is transparent on both iOS and Android  
✅ Video plays automatically on both platforms  
✅ Service worker registers successfully on iOS Safari  
✅ Offline mode works on iOS (cached content accessible)  
✅ No regressions on Android Chrome  
✅ Performance remains acceptable  

---

## Implementation Order

### Phase 1: Green Screen Fix (High Priority)
1. Task 1: Replace CSS filter with canvas component
2. Task 6: Test on iOS device

### Phase 2: Offline Mode Fix (High Priority)
3. Task 2: Update PWA manifest
4. Task 3: Add iOS meta tags
5. Task 4: Improve SW registration
6. Task 5: Enhance cache strategies
7. Task 7: Test offline mode on iOS

### Phase 3: Validation (High Priority)
8. Task 8: Test on Android (no regressions)
9. Task 9: Update documentation

---

## Technical Details

### Current Stack
- **Framework:** Vue 3 (Composition API)
- **PWA Plugin:** vite-plugin-pwa
- **Service Worker:** Workbox (injectManifest strategy)
- **Offline Storage:** IndexedDB
- **Video Processing:** Canvas API

### Browser Support
- iOS Safari 12+ (PWA support)
- Android Chrome 80+
- Desktop browsers (latest versions)

### Key Technologies
- Canvas API for video processing
- Service Worker API for offline caching
- IndexedDB for local data persistence
- Workbox for cache strategies

---

## Known Limitations

1. **iOS Storage Quota:** iOS limits service worker cache to ~50MB
2. **iOS Cache Clearing:** iOS may clear caches aggressively when storage is low
3. **iOS Home Screen:** User must manually add PWA to home screen (no install prompt)
4. **First Load:** Initial app visit requires internet connection
5. **iOS Version:** Requires iOS 12+ for stable PWA support

---

## Related Documentation

- **Design Document:** `design.md` - Detailed technical design and architecture
- **Requirements Document:** `requirements.md` - Business and functional requirements
- **Tasks Document:** `tasks.md` - Detailed implementation tasks

---

## References

### External Resources
- [iOS PWA Support](https://firt.dev/notes/pwa-ios/)
- [Service Worker on iOS](https://webkit.org/blog/8090/workers-at-your-service/)
- [Canvas Green Screen](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas)
- [Workbox Strategies](https://developers.google.com/web/tools/workbox/modules/workbox-strategies)

### Internal Resources
- Existing `TransparentVideo.vue` component
- Existing `OfflineBanner.vue` component
- Existing `syncEngine.js` for offline sync
- Existing `offlineDb.js` for IndexedDB

---

## Questions or Issues?

If you encounter any issues during implementation:

1. Check browser console for error messages
2. Verify iOS version (12+ required)
3. Confirm HTTPS is being used (required for SW)
4. Check service worker registration logs
5. Verify icon files exist at specified paths
6. Test in both browser and PWA standalone modes

---

## Next Steps

1. Review this specification with the team
2. Ensure all dependencies are understood
3. Begin with Phase 1 (Green Screen Fix)
4. Test thoroughly on actual iOS devices
5. Document any iOS-specific quirks discovered
6. Update this spec if new requirements emerge

---

**Spec Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Author:** Kiro AI  
**Status:** ✅ Ready for Implementation
