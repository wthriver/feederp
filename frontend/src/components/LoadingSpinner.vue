<template>
  <div v-if="loading" class="loading-overlay" :class="{ 'loading-inline': inline }">
    <div class="loading-spinner-container">
      <div class="spinner" :class="sizeClass"></div>
      <span v-if="message" class="loading-message">{{ message }}</span>
    </div>
  </div>
  <div v-else class="loading-content">
    <slot></slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  message: String,
  inline: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'medium',
    validator: (s) => ['small', 'medium', 'large'].includes(s)
  }
})

const sizeClass = computed(() => `spinner-${props.size}`)
</script>

<style scoped>
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 20px;
}

.loading-inline {
  min-height: auto;
  padding: 10px;
}

.loading-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  width: 20px;
  height: 20px;
}

.spinner-medium {
  width: 36px;
  height: 36px;
}

.spinner-large {
  width: 48px;
  height: 48px;
}

.loading-message {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.loading-content {
  min-height: inherit;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>