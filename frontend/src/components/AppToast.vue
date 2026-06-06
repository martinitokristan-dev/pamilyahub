<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, removeToast } = useToast()

function shouldInline(toast) {
  if (!toast.subtitle) return true
  const totalLength = toast.title.length + toast.subtitle.length
  return totalLength < 28
}
</script>

<template>
  <TransitionGroup
    tag="div"
    class="app-toast-container"
    name="toast-transition"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="app-toast-pill"
    >
      <div class="app-toast-text-content">
        <template v-if="!toast.subtitle">
          <div class="flex items-center gap-2">
            <span class="app-toast-single-line">{{ toast.title }}</span>
            <button 
              v-if="toast.action" 
              @click.stop="toast.action.onClick(); removeToast(toast.id)"
              class="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
            >
              {{ toast.action.text }}
            </button>
          </div>
        </template>
        <template v-else-if="shouldInline(toast)">
          <div class="flex items-center gap-2">
            <span class="app-toast-single-line">{{ toast.title }} · {{ toast.subtitle }}</span>
            <button 
              v-if="toast.action" 
              @click.stop="toast.action.onClick(); removeToast(toast.id)"
              class="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
            >
              {{ toast.action.text }}
            </button>
          </div>
        </template>
        <template v-else>
          <div class="app-toast-stacked">
            <div class="app-toast-title">{{ toast.title }}</div>
            <div class="app-toast-subtitle">{{ toast.subtitle }}</div>
            <button 
              v-if="toast.action" 
              @click.stop="toast.action.onClick(); removeToast(toast.id)"
              class="mt-2.5 w-fit rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
            >
              {{ toast.action.text }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.app-toast-container {
  position: fixed;
  bottom: 110px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: fit-content;
  max-width: calc(100% - 64px);
}

.app-toast-pill {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(50, 50, 50, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: none;
  box-shadow: none;
  padding: 12px 22px;
  border-radius: 22px;
  width: fit-content;
  min-width: 160px;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
}

.app-toast-text-content {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  text-align: center;
  width: 100%;
}

.app-toast-single-line {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.app-toast-stacked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.app-toast-title {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  white-space: normal;
  line-height: 1.4;
}

.app-toast-subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  margin-top: 2px;
  white-space: normal;
  line-height: 1.4;
}

/* Slide up/down transition logic */
.toast-transition-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-transition-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-transition-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.toast-transition-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.toast-transition-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.toast-transition-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
