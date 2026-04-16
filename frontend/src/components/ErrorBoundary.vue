<template>
    <slot v-if="!hasError"></slot>
    <div v-else class="error-boundary" role="alert">
        <div class="error-content">
            <div class="error-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h2 class="error-title">{{ title }}</h2>
            <p class="error-message">{{ message }}</p>
            <div v-if="showDetails && error" class="error-details">
                <details>
                    <summary>{{ $t('common.errorDetails') || 'Error Details' }}</summary>
                    <pre>{{ errorStack }}</pre>
                </details>
            </div>
            <div class="error-actions">
                <button v-if="showRetry" class="btn btn-primary" @click="handleRetry">
                    {{ $t('common.retry') || 'Retry' }}
                </button>
                <button class="btn" @click="handleGoBack">
                    {{ $t('common.goBack') || 'Go Back' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onErrorCaptured } from 'vue'

const props = defineProps({
    title: {
        type: String,
        default: 'Something went wrong'
    },
    message: {
        type: String,
        default: 'An unexpected error occurred. Please try again.'
    },
    showDetails: {
        type: Boolean,
        default: false
    },
    showRetry: {
        type: Boolean,
        default: true
    },
    onError: {
        type: Function,
        default: null
    }
})

const emit = defineEmits(['retry', 'error'])

const hasError = ref(false)
const error = ref(null)

const errorStack = computed(() => {
    if (!error.value) return ''
    if (typeof error.value === 'string') return error.value
    return error.value.stack || JSON.stringify(error.value, null, 2)
})

onErrorCaptured((err, instance, info) => {
    hasError.value = true
    error.value = err
    
    if (props.onError) {
        props.onError(err, info)
    }
    
    emit('error', err, info)
    
    return false
})

const handleRetry = () => {
    hasError.value = false
    error.value = null
    emit('retry')
}

const handleGoBack = () => {
    if (window.history.length > 1) {
        window.history.back()
    } else {
        window.location.href = '/'
    }
}
</script>

<style scoped>
.error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 2rem;
}

.error-content {
    text-align: center;
    max-width: 480px;
}

.error-icon {
    color: var(--danger, #e74c3c);
    margin-bottom: 1rem;
}

.error-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #333);
    margin: 0 0 0.5rem;
}

.error-message {
    color: var(--text-muted, #666);
    margin: 0 0 1.5rem;
}

.error-details {
    text-align: left;
    margin-bottom: 1.5rem;
}

.error-details details {
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    padding: 1rem;
}

.error-details summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--text-primary, #333);
}

.error-details pre {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-primary, #fff);
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.75rem;
    max-height: 200px;
}

.error-actions {
    display: flex;
    gap: 1rem;
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
