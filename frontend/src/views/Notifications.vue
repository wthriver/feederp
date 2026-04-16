<template>
    <div class="notifications-page">
        <div class="page-header">
            <h1>Notifications</h1>
            <div class="header-actions">
                <button v-if="unreadCount > 0" class="btn btn-sm" @click="markAllRead">
                    Mark All Read
                </button>
            </div>
        </div>

        <div class="filters">
            <select v-model="filters.type" class="select-field" @change="loadNotifications">
                <option value="">All Types</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
            </select>
            <select v-model="filters.is_read" class="select-field" @change="loadNotifications">
                <option value="">All Status</option>
                <option value="false">Unread</option>
                <option value="true">Read</option>
            </select>
            <select v-model="filters.priority" class="select-field" @change="loadNotifications">
                <option value="">All Priority</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
            </select>
        </div>

        <div v-if="loading" class="loading">
            <LoadingSpinner />
        </div>

        <div v-else-if="notifications.length === 0" class="empty-state">
            <EmptyState title="No Notifications" message="You're all caught up!" />
        </div>

        <div v-else class="notifications-list">
            <div
                v-for="notification in notifications"
                :key="notification.id"
                :class="['notification-card', { unread: !notification.is_read, priority: notification.priority }]"
                @click="handleNotificationClick(notification)"
            >
                <div class="notification-icon">
                    <span v-if="notification.type === 'warning'">⚠️</span>
                    <span v-else-if="notification.type === 'success'">✓</span>
                    <span v-else-if="notification.type === 'error'">✕</span>
                    <span v-else>ℹ️</span>
                </div>
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-title">{{ notification.title }}</span>
                        <span :class="['priority-badge', notification.priority]">{{ notification.priority }}</span>
                    </div>
                    <p class="notification-message">{{ notification.message }}</p>
                    <div class="notification-meta">
                        <span class="notification-time">{{ formatDate(notification.created_at) }}</span>
                    </div>
                </div>
                <div class="notification-actions">
                    <button v-if="!notification.is_read" class="btn-icon" @click.stop="markRead(notification)">
                        ✓
                    </button>
                    <button class="btn-icon" @click.stop="deleteNotification(notification)">
                        🗑️
                    </button>
                </div>
            </div>
        </div>

        <div v-if="meta.total > meta.limit" class="pagination">
            <button class="btn btn-sm" :disabled="meta.page <= 1" @click="loadNotifications(meta.page - 1)">
                Previous
            </button>
            <span>Page {{ meta.page }} of {{ meta.totalPages }}</span>
            <button class="btn btn-sm" :disabled="meta.page >= meta.totalPages" @click="loadNotifications(meta.page + 1)">
                Next
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const loading = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const meta = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const filters = ref({ type: '', is_read: '', priority: '' })

async function loadNotifications(page = 1) {
    loading.value = true
    try {
        const response = await api.get('/notifications', {
            params: {
                page,
                limit: 20,
                type: filters.value.type,
                is_read: filters.value.is_read,
                priority: filters.value.priority
            }
        })
        if (response.data.success) {
            notifications.value = response.data.data
            meta.value = response.data.meta
            unreadCount.value = response.data.meta?.unread || 0
        }
    } catch (error) {
        console.error('Failed to load notifications:', error)
    } finally {
        loading.value = false
    }
}

async function markRead(notification) {
    try {
        await api.post(`/notifications/${notification.id}/read`)
        notification.is_read = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (error) {
        console.error('Failed to mark read:', error)
    }
}

async function markAllRead() {
    try {
        await api.post('/notifications/read-all')
        notifications.value.forEach(n => n.is_read = true)
        unreadCount.value = 0
        window.showToast?.({ type: 'success', message: 'All notifications marked as read' })
    } catch (error) {
        console.error('Failed to mark all read:', error)
    }
}

async function deleteNotification(notification) {
    try {
        await api.delete(`/notifications/${notification.id}`)
        notifications.value = notifications.value.filter(n => n.id !== notification.id)
    } catch (error) {
        console.error('Failed to delete:', error)
    }
}

function handleNotificationClick(notification) {
    if (!notification.is_read) {
        markRead(notification)
    }
    if (notification.action_url) {
        router.push(notification.action_url)
    }
}

function formatDate(date) {
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
}

onMounted(() => {
    loadNotifications()
})
</script>

<style scoped>
.notifications-page {
    padding: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.page-header h1 {
    font-size: 18px;
    font-weight: 600;
}

.filters {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.filters .select-field {
    padding: 6px 12px;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    background: var(--bg-primary);
}

.notifications-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.notification-card {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
}

.notification-card:hover {
    background: var(--bg-hover);
}

.notification-card.unread {
    background: #f0f9ff;
    border-left: 3px solid var(--color-primary);
}

.notification-card.priority-high {
    border-left: 3px solid var(--color-danger);
}

.notification-icon {
    font-size: 20px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 50%;
}

.notification-content {
    flex: 1;
}

.notification-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.notification-title {
    font-weight: 600;
    color: var(--text-primary);
}

.priority-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
}

.priority-badge.high {
    background: #fee2e2;
    color: #dc2626;
}

.priority-badge.normal {
    background: #e0e7ff;
    color: #4f46e5;
}

.priority-badge.low {
    background: #f3f4f6;
    color: #6b7280;
}

.notification-message {
    color: var(--text-muted);
    font-size: 13px;
    margin-bottom: 4px;
}

.notification-meta {
    font-size: 12px;
    color: var(--text-muted);
}

.notification-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    opacity: 0.5;
}

.btn-icon:hover {
    opacity: 1;
}

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
}
</style>