# Performance Optimizations for Low-End Devices

This document outlines all performance optimizations implemented to ensure smooth experience on low-end iOS and Android devices.

## CSS Optimizations (main.css)

### 1. GPU Acceleration
- All animated elements use `transform: translateZ(0)` to force GPU rendering
- `backface-visibility: hidden` prevents flickering during animations
- `will-change` hints prepare the browser for upcoming animations

### 2. Optimized Animations
- Reduced animation durations to 200ms for snappier feel
- Use `cubic-bezier(0.4, 0, 0.2, 1)` easing for smooth transitions
- All keyframe animations use `translate3d()` instead of `translate()` for hardware acceleration

### 3. Touch Optimizations
- `-webkit-tap-highlight-color: transparent` removes tap delay
- `touch-action: manipulation` on buttons prevents double-tap zoom
- `-webkit-overflow-scrolling: touch` enables momentum scrolling on iOS

### 4. Reduced Motion Support
- Respects `prefers-reduced-motion` for accessibility
- Reduces all animations to 0.01ms when user prefers reduced motion

### 5. Optimized Backdrop Blur
- Feature detection for `backdrop-filter` support
- Falls back to solid background color on unsupported devices
- Reduced blur amount (8px) for better performance

## Component Optimizations

### OptimizedModal Component
Located at: `src/components/ui/OptimizedModal.vue`

Features:
- Lazy rendering with Teleport
- Prevents body scroll when open
- Uses optimized transitions
- GPU-accelerated transforms
- Responsive sizing (sm, md, lg)
- Mobile-first design with full-screen option

Usage:
```vue
<OptimizedModal :show="isOpen" size="md" @close="handleClose">
  <div class="p-6">
    <!-- Your modal content -->
  </div>
</OptimizedModal>
```

### AI Chatbot Optimizations
Located at: `src/components/AiChat.vue`

Features:
- Throttled activity detection (150ms) reduces CPU usage
- Passive event listeners for scrolling/touch
- GPU-accelerated button transitions
- Staggered animations (width → opacity)
- Inline styles for smoother transitions

## Tailwind Config Updates

### New Optimized Animations
- `animate-optimized-fade` - Simple fade in
- `animate-optimized-slide-up` - Slide from bottom
- `animate-optimized-slide-down` - Slide from top
- `animate-optimized-zoom` - Scale + fade

All use:
- 200ms duration
- `cubic-bezier(0.4, 0, 0.2, 1)` easing
- `translate3d()` for GPU acceleration

## Best Practices for Modal Development

### 1. Always Use Optimized Classes
```vue
<!-- ✅ Good -->
<div class="transition-optimized transform-gpu">

<!-- ❌ Avoid -->
<div class="transition-all duration-500">
```

### 2. Minimize Backdrop Blur
```vue
<!-- ✅ Good - Simple blur -->
<div class="backdrop-blur-sm">

<!-- ❌ Avoid - Heavy blur -->
<div class="backdrop-blur-2xl">
```

### 3. Use Hardware-Accelerated Transforms
```vue
<!-- ✅ Good -->
<div :style="{ transform: `translate3d(0, ${y}px, 0)` }">

<!-- ❌ Avoid -->
<div :style="{ transform: `translateY(${y}px)` }">
```

### 4. Throttle Event Handlers
```javascript
// ✅ Good
let lastTime = 0
const THROTTLE = 150

function handleScroll() {
  const now = Date.now()
  if (now - lastTime < THROTTLE) return
  lastTime = now
  // Your logic
}
```

### 5. Use Passive Event Listeners
```javascript
// ✅ Good
window.addEventListener('scroll', handler, { passive: true })

// ❌ Avoid
window.addEventListener('scroll', handler)
```

### 6. Reduce Paint Operations
```vue
<!-- ✅ Good - Contained repaints -->
<div class="modal-container">

<!-- ❌ Avoid - Full page repaints -->
<div class="relative">
```

## Performance Checklist for New Modals

- [ ] Use `OptimizedModal` component or follow its pattern
- [ ] Add `transform-gpu` class to animated elements
- [ ] Use `transition-optimized` instead of `transition-all`
- [ ] Throttle scroll/touch event handlers
- [ ] Use passive event listeners where possible
- [ ] Test on actual low-end devices (not just DevTools throttling)
- [ ] Minimize backdrop blur intensity
- [ ] Use `will-change` hints for upcoming animations
- [ ] Prevent body scroll when modal is open
- [ ] Clean up event listeners on unmount

## Testing Performance

### Chrome DevTools
1. Open DevTools > Performance
2. Enable CPU throttling (4x slowdown)
3. Record while opening/closing modals
4. Look for:
   - FPS < 30fps (bad)
   - Long tasks > 50ms
   - Excessive repaints

### Real Device Testing
1. Test on actual low-end Android (Snapdragon 4xx series)
2. Test on older iPhones (iPhone 7/8)
3. Monitor for:
   - Stuttering during animations
   - Delayed touch responses
   - Janky scrolling

## Common Performance Issues

### Issue: Modal animations are janky
**Solution**: 
- Add `transform-gpu` class
- Use `translate3d()` instead of `translate()`
- Reduce animation duration to 200ms

### Issue: Scrolling feels sluggish
**Solution**:
- Add `{ passive: true }` to scroll listeners
- Use `-webkit-overflow-scrolling: touch`
- Throttle scroll handlers

### Issue: Backdrop blur is slow
**Solution**:
- Reduce blur amount to 8px or less
- Use feature detection and fallback
- Consider removing blur on very low-end devices

### Issue: Touch responses are delayed
**Solution**:
- Add `touch-action: manipulation` to buttons
- Remove `-webkit-tap-highlight-color`
- Use `@pointerdown` instead of `@click` where appropriate

## Browser Support

All optimizations are tested and working on:
- iOS Safari 13+
- Chrome Android 80+
- Samsung Internet 12+
- Firefox Mobile 90+

## Future Improvements

1. Add device capability detection
2. Dynamically disable effects on very low-end devices
3. Implement lazy loading for modal content
4. Add virtual scrolling for long lists in modals
5. Consider using CSS containment more aggressively

## Resources

- [Web.dev - Rendering Performance](https://web.dev/rendering-performance/)
- [MDN - CSS will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [Google - Passive Event Listeners](https://developer.chrome.com/docs/lighthouse/best-practices/uses-passive-event-listeners/)
