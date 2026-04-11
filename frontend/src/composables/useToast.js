import { ref } from 'vue'

const toasts = ref([])
let id = 0

function show({ type = 'info', title = '', message, duration = 4000 }) {
    const toast = {
        id: ++id,
        type,
        title,
        message,
        createdAt: Date.now()
    }
    toasts.value.push(toast)
    
    if (duration > 0) {
        setTimeout(() => {
            remove(toast.id)
        }, duration)
    }
    
    return toast.id
}

function remove(toastId) {
    const idx = toasts.value.findIndex(t => t.id === toastId)
    if (idx > -1) {
        toasts.value.splice(idx, 1)
    }
}

function success(message, title = 'Success') {
    return show({ type: 'success', title, message })
}

function error(message, title = 'Error') {
    return show({ type: 'error', title, message, duration: 6000 })
}

function warning(message, title = 'Warning') {
    return show({ type: 'warning', title, message })
}

function info(message, title = 'Info') {
    return show({ type: 'info', title, message })
}

export function useToast() {
    return {
        toasts,
        show,
        remove,
        success,
        error,
        warning,
        info
    }
}

export function showToast(options) {
    return show(options)
}

export function showSuccess(message, title) {
    return success(message, title)
}

export function showError(message, title) {
    return error(message, title)
}