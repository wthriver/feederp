<template>
    <Teleport to="body">
        <div v-if="show" class="confirm-overlay" @click.self="cancel">
            <div class="confirm-dialog">
                <div class="confirm-header">
                    <span class="confirm-icon" :class="type">{{ icon }}</span>
                    <h3>{{ title }}</h3>
                </div>
                <div class="confirm-body">
                    <p>{{ message }}</p>
                </div>
                <div class="confirm-footer">
                    <button class="btn" @click="cancel">{{ cancelText }}</button>
                    <button 
                        class="btn" 
                        :class="confirmClass" 
                        @click="confirm"
                        :disabled="loading"
                    >
                        {{ loading ? 'Processing...' : confirmText }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const show = ref(false)
const loading = ref(false)
const title = ref('Confirm')
const message = ref('Are you sure?')
const confirmText = ref('Confirm')
const cancelText = ref('Cancel')
const type = ref('warning')
const onConfirm = ref(null)
const onCancel = ref(null)

const icon = computed(() => {
    switch (type.value) {
        case 'danger': return '⚠'
        case 'success': return '✓'
        case 'info': return 'ℹ'
        default: return '?'
    }
})

const confirmClass = computed(() => {
    switch (type.value) {
        case 'danger': return 'btn-danger'
        case 'success': return 'btn-success'
        default: return 'btn-primary'
    }
})

function open(options) {
    title.value = options.title || 'Confirm'
    message.value = options.message || 'Are you sure?'
    confirmText.value = options.confirmText || 'Confirm'
    cancelText.value = options.cancelText || 'Cancel'
    type.value = options.type || 'warning'
    onConfirm.value = options.onConfirm
    onCancel.value = options.onCancel
    show.value = true
}

function cancel() {
    show.value = false
    if (onCancel.value) onCancel.value()
}

async function confirm() {
    loading.value = true
    try {
        if (onConfirm.value) {
            await onConfirm.value()
        }
        show.value = false
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

defineExpose({ open, show })
</script>

<style scoped>
.confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1500;
    pointer-events: auto;
}

.confirm-dialog {
    pointer-events: auto;
    background: var(--bg-primary);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 400px;
    overflow: hidden;
}

.confirm-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border-light);
}

.confirm-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 18px;
    background: var(--warning);
    color: white;
}

.confirm-icon.danger { background: var(--danger); }
.confirm-icon.success { background: var(--success); }
.confirm-icon.info { background: var(--info); }

.confirm-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.confirm-body {
    padding: 16px;
}

.confirm-body p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 14px;
}

.confirm-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    justify-content: flex-end;
}

.confirm-footer .btn {
    min-width: 80px;
}
</style>