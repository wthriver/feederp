<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
    modelValue: Boolean,
    title: { type: String, default: '' },
    size: { type: String, default: 'lg' },
    loading: Boolean,
    showClose: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'close'])

const modalRef = ref(null)

const sizeClass = computed(() => {
    const sizes = { sm: 'odoo-modal-sm', md: 'odoo-modal-md', lg: 'odoo-modal-lg', xl: 'odoo-modal-xl', full: 'odoo-modal-full' }
    return sizes[props.size] || sizes.lg
})

function close() {
    emit('update:modelValue', false)
    emit('close')
}

function handleKeydown(e) {
    if (e.key === 'Escape' && props.closeOnEsc && props.modelValue) {
        close()
    }
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
})

watch(() => props.modelValue, (val) => {
    if (val) {
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
})
</script>

<template>
    <Teleport to="body">
        <Transition name="odoo-modal-fade">
            <div v-if="modelValue" class="odoo-modal-overlay" @click.self="close">
                <div class="odoo-modal-container" :class="sizeClass">
                    <div class="odoo-modal-header">
                        <div class="odoo-modal-title">{{ title }}</div>
                        <button v-if="showClose" class="odoo-modal-close" @click="close" :disabled="loading">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="odoo-modal-body">
                        <slot></slot>
                    </div>
                    
                    <div class="odoo-modal-footer">
                        <slot name="footer">
                            <button class="btn btn-secondary" @click="close" :disabled="loading">Cancel</button>
                        </slot>
                    </div>
                    
                    <div v-if="loading" class="odoo-modal-loading">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.odoo-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 16px;
    overflow-y: auto;
    z-index: 9999;
}

.odoo-modal-container {
    background: var(--bg-card, #fff);
    border-radius: 4px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 96px);
}

.odoo-modal-sm { max-width: 480px; }
.odoo-modal-md { max-width: 640px; }
.odoo-modal-lg { max-width: 800px; }
.odoo-modal-xl { max-width: 1024px; }
.odoo-modal-full { max-width: 1400px; }

.odoo-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-card);
    border-radius: 4px 4px 0 0;
}

.odoo-modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #333);
    margin: 0;
}

.odoo-modal-close {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-muted, #666);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.odoo-modal-close:hover {
    background: var(--bg-hover, #f5f5f5);
    color: var(--text-primary, #333);
}

.odoo-modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}

.odoo-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-card);
    border-radius: 0 0 4px 4px;
}

.odoo-modal-loading {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.odoo-modal-fade-enter-active,
.odoo-modal-fade-leave-active {
    transition: opacity 0.2s ease;
}

.odoo-modal-fade-enter-active .odoo-modal-container,
.odoo-modal-fade-leave-active .odoo-modal-container {
    transition: transform 0.2s ease, opacity 0.2s ease;
}

.odoo-modal-fade-enter-from,
.odoo-modal-fade-leave-to {
    opacity: 0;
}

.odoo-modal-fade-enter-from .odoo-modal-container {
    transform: translateY(-20px);
    opacity: 0;
}

.odoo-modal-fade-leave-to .odoo-modal-container {
    transform: translateY(20px);
    opacity: 0;
}
</style>