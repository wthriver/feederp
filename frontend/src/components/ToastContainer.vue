<template>
    <Teleport to="body">
        <div class="toast-container">
            <TransitionGroup name="toast">
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    :class="['toast', `toast-${toast.type}`]"
                >
                    <div class="toast-icon">
                        <template v-if="toast.type === 'success'">✓</template>
                        <template v-else-if="toast.type === 'error'">✕</template>
                        <template v-else-if="toast.type === 'warning'">⚠</template>
                        <template v-else>ℹ</template>
                    </div>
                    <div class="toast-content">
                        <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
                        <div class="toast-message">{{ toast.message }}</div>
                    </div>
                    <button class="toast-close" @click="remove(toast.id)">×</button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-container {
    position: fixed;
    top: 80px;
    right: 16px;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    pointer-events: none;
}

.toast {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast-success { border-left: 4px solid var(--success); }
.toast-error { border-left: 4px solid var(--danger); }
.toast-warning { border-left: 4px solid var(--warning); }
.toast-info { border-left: 4px solid var(--info); }

.toast-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
    flex-shrink: 0;
}

.toast-success .toast-icon { background: var(--success); color: white; }
.toast-error .toast-icon { background: var(--danger); color: white; }
.toast-warning .toast-icon { background: var(--warning); color: white; }
.toast-info .toast-icon { background: var(--info); color: white; }

.toast-content { flex: 1; min-width: 0; }

.toast-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 2px;
}

.toast-message {
    font-size: 13px;
    color: var(--text-secondary);
}

.toast-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    line-height: 1;
}

.toast-close:hover { color: var(--text-primary); }

.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateX(100%);
}
</style>