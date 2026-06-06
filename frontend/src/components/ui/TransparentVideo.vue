<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  tolerance: { type: Number, default: 25 },
  videoClass: { type: String, default: '' }
})

const videoRef = ref(null)
const canvasRef = ref(null)
let animationFrameId = null

const processFrame = () => {
  if (!videoRef.value || !canvasRef.value) return
  if (videoRef.value.paused || videoRef.value.ended) {
    animationFrameId = requestAnimationFrame(processFrame)
    return
  }

  const ctx = canvasRef.value.getContext('2d', { willReadFrequently: true })

  // Optimize performance: Do not process 4K video at full resolution!
  // Cap the internal processing resolution to 150px wide (perfect for the tiny 128px dashboard container).
  const MAX_WIDTH = 150
  let targetWidth = videoRef.value.videoWidth
  let targetHeight = videoRef.value.videoHeight

  if (targetWidth > MAX_WIDTH) {
    const ratio = MAX_WIDTH / targetWidth
    targetWidth = MAX_WIDTH
    targetHeight = Math.floor(videoRef.value.videoHeight * ratio)
  }

  if (canvasRef.value.width !== targetWidth) {
    canvasRef.value.width = targetWidth
    canvasRef.value.height = targetHeight
  }

  const w = canvasRef.value.width
  const h = canvasRef.value.height

  if (w === 0 || h === 0) {
    animationFrameId = requestAnimationFrame(processFrame)
    return
  }

  ctx.drawImage(videoRef.value, 0, 0, w, h)
  
  let frame
  try {
    frame = ctx.getImageData(0, 0, w, h)
  } catch (e) {
    console.error('Canvas getImageData error:', e)
    animationFrameId = requestAnimationFrame(processFrame)
    return
  }
  
  const l = frame.data.length

  for (let i = 0; i < l; i += 4) {
    const r = frame.data[i + 0]
    const g = frame.data[i + 1]
    const b = frame.data[i + 2]
    
    // Absolute Green Killer Algorithm (Perfect for non-green mascots)
    const maxRB = Math.max(r, b)
    
    // If green is the dominant color...
    if (g > maxRB) {
      const greenness = g - maxRB
      
      if (greenness > 50) {
        // It's the bright green background: make it fully invisible
        frame.data[i + 3] = 0
      } else {
        // Soften the edge. Optimized math: alphaRatio * alphaRatio instead of Math.pow for speed
        const alphaRatio = 1 - (greenness / 50)
        frame.data[i + 3] = Math.floor(255 * (alphaRatio * alphaRatio))
      }
      
      // Kill the green color completely
      frame.data[i + 1] = maxRB
    }
  }

  try {
    ctx.putImageData(frame, 0, 0)
  } catch (e) {
    console.error('Canvas putImageData error:', e)
  }
  
  animationFrameId = requestAnimationFrame(processFrame)
}

const startVideo = () => {
  if (!videoRef.value) return
  // Force play to ensure it restarts when returning to the tab
  videoRef.value.play().catch(e => console.log('Autoplay prevented:', e))
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  animationFrameId = requestAnimationFrame(processFrame)
}

const stopVideo = () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (videoRef.value) videoRef.value.pause()
}

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.addEventListener('play', () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(processFrame)
    })
    startVideo()
  }
})

onUnmounted(() => {
  stopVideo()
})

// Support for <keep-alive> route caching
onActivated(() => {
  startVideo()
})

onDeactivated(() => {
  stopVideo()
})
</script>

<template>
  <div class="relative flex items-center justify-center w-full h-full">
    <video 
      ref="videoRef" 
      :src="src" 
      autoplay loop muted playsinline 
      class="absolute opacity-0 pointer-events-none w-0 h-0"
    ></video>
    <canvas ref="canvasRef" :class="videoClass"></canvas>
  </div>
</template>
