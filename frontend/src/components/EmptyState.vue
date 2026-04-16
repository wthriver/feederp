<template>
  <div 
    class="empty-state" 
    :class="sizeClass"
    role="status"
    :aria-label="ariaLabel"
  >
    <div class="empty-icon-wrapper">
      <svg v-if="useSvg" class="empty-icon" :class="{ 'animate-empty': animate }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path v-if="type === 'search'" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else-if="type === 'error'" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span v-else class="empty-icon" :class="{ 'animate-empty': animate }">{{ icon }}</span>
    </div>
    
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="description" class="empty-description">{{ description }}</p>
    
    <div v-if="$slots.action || actionText" class="empty-actions">
      <slot name="action">
        <button v-if="actionText" class="btn btn-primary" @click="$emit('action')">
          {{ actionText }}
        </button>
      </slot>
    </div>
    
    <span class="sr-only">{{ srText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: {
    type: String,
    default: '📭'
  },
  title: {
    type: String,
    default: 'No data found'
  },
  description: String,
  actionText: String,
  type: {
    type: String,
    default: 'default',
    validator: (t) => ['default', 'search', 'error'].includes(t)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (s) => ['small', 'medium', 'large'].includes(s)
  },
  animate: {
    type: Boolean,
    default: false
  }
})

defineEmits(['action'])

const useSvg = computed(() => props.type !== 'default' && !props.icon?.length)

const sizeClass = computed(() => `empty-state-${props.size}`)

const ariaLabel = computed(() => props.title)

const srText = computed(() => `${props.title}. ${props.description || ''}`)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state-small {
  padding: 20px 10px;
}

.empty-state-small .empty-icon {
  width: 32px;
  height: 32px;
}

.empty-state-small .empty-title {
  font-size: var(--font-size-sm);
  margin-bottom: 8px;
}

.empty-state-small .empty-description {
  font-size: var(--font-size-xs);
}

.empty-state-large {
  padding: 60px 40px;
}

.empty-state-large .empty-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.empty-icon-wrapper {
  margin-bottom: 16px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.5;
  color: var(--text-muted);
}

.animate-empty {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.empty-description {
  font-size: var(--font-size-sm);
  max-width: 400px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>