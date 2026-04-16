<template>
    <Teleport to="body">
        <Transition name="modal-fade">
            <div 
                v-if="modelValue" 
                class="modal-overlay" 
                :class="{ 'clickable': closeOnOverlay }" 
                @click.self="handleOverlayClick"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                :aria-describedby="descriptionId"
            >
                <Transition name="modal-scale">
                    <div class="modal-container" :class="[`modal-${size}`, variant]" ref="modalRef" tabindex="-1">
                        <div v-if="$slots.header || title" class="modal-header">
                            <slot name="header">
                                <div class="modal-header-content">
                                    <span v-if="icon" class="modal-icon">{{ icon }}</span>
                                    <div class="modal-title-wrapper">
                                        <h3 :id="titleId" class="modal-title">{{ title }}</h3>
                                        <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
                                    </div>
                                </div>
                            </slot>
                            <button v-if="showClose" class="modal-close" @click="close" :disabled="loading" aria-label="Close modal">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        
                        <div :id="descriptionId" class="modal-body">
                            <slot></slot>
                        </div>
                        
                        <div v-if="$slots.footer" class="modal-footer">
                            <slot name="footer"></slot>
                        </div>
                        
                        <div v-if="loading" class="modal-loading-overlay">
                            <div class="modal-loading-spinner"></div>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, ref, nextTick } from 'vue'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: ''
    },
    subtitle: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: ''
    },
    size: {
        type: String,
        default: 'md',
        validator: (v) => ['xs', 'sm', 'md', 'lg', 'xl', 'full'].includes(v)
    },
    variant: {
        type: String,
        default: 'default'
    },
    showClose: {
        type: Boolean,
        default: true
    },
    closeOnOverlay: {
        type: Boolean,
        default: true
    },
    closeOnEsc: {
        type: Boolean,
        default: true
    },
    loading: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'close'])

const modalRef = ref(null)
const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`)
const descriptionId = computed(() => `modal-desc-${Math.random().toString(36).substr(2, 9)}`)

function close() {
    if (!props.loading) {
        emit('update:modelValue', false)
        emit('close')
    }
}

function handleOverlayClick() {
    if (props.closeOnOverlay) {
        close()
    }
}

function handleKeydown(e) {
    if (e.key === 'Escape' && props.closeOnEsc && props.modelValue) {
        close()
    }
    
    if (e.key === 'Tab' && props.modelValue) {
        const focusableElements = modalRef.value?.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements && focusableElements.length > 0) {
            const firstEl = focusableElements[0]
            const lastEl = focusableElements[focusableElements.length - 1]
            
            if (e.shiftKey && document.activeElement === firstEl) {
                e.preventDefault()
                lastEl.focus()
            } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault()
                firstEl.focus()
            }
        }
    }
}

watch(() => props.modelValue, async (isOpen) => {
    if (isOpen) {
        document.body.style.overflow = 'hidden'
        await nextTick()
        modalRef.value?.focus()
    } else {
        document.body.style.overflow = ''
    }
})

onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
})
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 16px;
}

.modal-overlay.clickable {
    cursor: pointer;
}

.modal-container {
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 
        0 0 0 1px rgba(0, 0, 0, 0.05),
        0 10px 15px -3px rgba(0, 0, 0, 0.1),
        0 20px 25px -5px rgba(0, 0, 0, 0.1),
        0 25px 50px -12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 32px);
    cursor: default;
    overflow: hidden;
}

.modal-xs { width: 90%; max-width: 360px; }
.modal-sm { width: 90%; max-width: 500px; }
.modal-md { width: 90%; max-width: 640px; }
.modal-lg { width: 90%; max-width: 800px; }
.modal-xl { width: 90%; max-width: 1000px; }
.modal-full { width: 95%; max-width: 1200px; height: 90vh; }

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-light);
    flex-shrink: 0;
    background: linear-gradient(to right, var(--bg-primary), var(--bg-secondary));
}

.modal-header-content {
    display: flex;
    align-items: center;
    gap: 14px;
}

.modal-icon {
    font-size: 24px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-light);
    border-radius: 12px;
}

.modal-title-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
}

.modal-subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
}

.modal-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.modal-close:hover:not(:disabled) {
    color: var(--danger);
    background: var(--danger-bg);
}

.modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    display: flex;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--border-light);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
    justify-content: flex-end;
    flex-shrink: 0;
}

.modal-footer:empty {
    display: none;
}

.modal-footer .btn {
    min-height: 34px;
    padding: 6px 14px;
}

.modal-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    border-radius: 16px;
}

.modal-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-light);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: modal-spin 0.8s linear infinite;
}

@keyframes modal-spin {
    to { transform: rotate(360deg); }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-scale-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-scale-leave-active {
    transition: all 0.2s ease;
}

.modal-scale-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
}

.modal-scale-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
}

@media (max-width: 480px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }
    
    .modal-container {
        border-radius: 20px 20px 0 0;
        max-height: 95vh;
        width: 100%;
        max-width: 100%;
    }
    
    .modal-header {
        padding: 16px 20px;
        border-radius: 20px 20px 0 0;
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .modal-footer {
        padding: 16px 20px;
        padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
}
</style>
