import { io } from 'socket.io-client'
import { useAuthStore } from '@/store/auth'

let socket = null
const listeners = new Map()

export function initSocket() {
    const authStore = useAuthStore()
    
    if (socket?.connected) return socket
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3006'
    socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    })

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id)
        if (authStore.isAuthenticated) {
            socket.emit('authenticate', {
                tenantId: authStore.user?.tenant_id,
                userId: authStore.user?.id
            })
        }
    })

    socket.on('authenticated', ({ success }) => {
        if (success) {
            console.log('[Socket] Authenticated successfully')
        }
    })

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected')
    })

    socket.on('error', (error) => {
        console.error('[Socket] Error:', error)
    })

    socket.on('stock_update', (data) => {
        console.log('[Socket] Stock update:', data)
        notifyListeners('stock_update', data)
    })

    socket.on('batch_update', (data) => {
        console.log('[Socket] Batch update:', data)
        notifyListeners('batch_update', data)
    })

    socket.on('order_update', (data) => {
        console.log('[Socket] Order update:', data)
        notifyListeners('order_update', data)
    })

    socket.on('iot_reading', (data) => {
        console.log('[Socket] IoT reading:', data)
        notifyListeners('iot_reading', data)
    })

    socket.on('notification', (data) => {
        console.log('[Socket] Notification:', data)
        window.showToast?.(data)
        notifyListeners('notification', data)
    })

    socket.on('activity', (data) => {
        console.log('[Socket] Activity:', data)
        notifyListeners('activity', data)
    })

    return socket
}

export function getSocket() {
    return socket
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}

export function subscribe(channel) {
    if (socket?.connected) {
        socket.emit('subscribe', channel)
    }
}

export function unsubscribe(channel) {
    if (socket?.connected) {
        socket.emit('unsubscribe', channel)
    }
}

export function onSocketEvent(event, callback) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set())
    }
    listeners.get(event).add(callback)
    
    return () => {
        listeners.get(event)?.delete(callback)
    }
}

function notifyListeners(event, data) {
    listeners.get(event)?.forEach(callback => {
        try {
            callback(data)
        } catch (e) {
            console.error(`[Socket] Listener error for ${event}:`, e)
        }
    })
}

export const socketEvents = {
    STOCK_UPDATE: 'stock_update',
    BATCH_UPDATE: 'batch_update',
    ORDER_UPDATE: 'order_update',
    IOT_READING: 'iot_reading',
    NOTIFICATION: 'notification',
    ACTIVITY: 'activity'
}
