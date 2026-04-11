<template>
    <div class="dashboard">
        <div class="page-header">
            <h1>{{ $t('nav.dashboard') }}</h1>
            <div class="header-actions">
                <input type="date" v-model="filterDate" @change="loadDashboard" class="input-field" />
            </div>
        </div>

        <div v-if="loading" class="loading">
            <div class="spinner"></div>
        </div>

        <div v-else class="dashboard-grid">
            <div class="stat-card" v-for="stat in stats" :key="stat.label">
                <div class="stat-icon">{{ stat.icon }}</div>
                <div class="stat-content">
                    <div class="stat-value">{{ stat.value }}</div>
                    <div class="stat-label">{{ $t(stat.label) }}</div>
                </div>
            </div>

            <div class="dashboard-card">
                <div class="card-header">
                    <h3>Production Trend</h3>
                </div>
                <div class="card-body">
                    <div class="chart-placeholder">
                        <div v-for="(item, idx) in productionData" :key="idx" class="chart-bar-container">
                            <div class="chart-bar" :style="{ height: (item.qty / maxProduction * 100) + '%' }"></div>
                            <span class="chart-label">{{ item.month }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-card">
                <div class="card-header">
                    <h3>Sales Trend</h3>
                </div>
                <div class="card-body">
                    <div class="chart-placeholder">
                        <div v-for="(item, idx) in salesData" :key="idx" class="chart-bar-container">
                            <div class="chart-bar sales" :style="{ height: (item.amount / maxSales * 100) + '%' }"></div>
                            <span class="chart-label">{{ item.month }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-card alerts-card">
                <div class="card-header">
                    <h3>{{ $t('dashboard.lowStockAlerts') }}</h3>
                    <span class="badge badge-danger">{{ alerts.low_stock }}</span>
                </div>
                <div class="card-body">
                    <div v-if="alerts.low_stock > 0" class="alert-list">
                        <div v-for="item in lowStockItems" :key="item.id" class="alert-item">
                            <span class="alert-name">{{ item.name }}</span>
                            <span class="alert-stock">
                                {{ item.current_stock }} / {{ item.min_stock }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="empty-state">
                        <p>{{ $t('dashboard.noLowStock') }}</p>
                    </div>
                </div>
            </div>

            <div class="dashboard-card">
                <div class="card-header">
                    <h3>{{ $t('dashboard.pendingOrders') }}</h3>
                </div>
                <div class="card-body">
                    <div class="pending-info">
                        <div class="pending-count">{{ pendingData.count || 0 }}</div>
                        <div class="pending-amount">₹{{ formatNumber(pendingData.amount || 0) }}</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-card">
                <div class="card-header">
                    <h3>{{ $t('dashboard.recentActivity') }}</h3>
                </div>
                <div class="card-body">
                    <div class="activity-list">
                        <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
                            <span class="activity-icon">{{ getActivityIcon(activity.action) }}</span>
                            <div class="activity-content">
                                <span class="activity-action">{{ activity.action }}</span>
                                <span class="activity-module">{{ activity.module }}</span>
                            </div>
                            <span class="activity-time">{{ formatTime(activity.created_at) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'

const loading = ref(true)
const filterDate = ref(new Date().toISOString().slice(0, 10))
const dashboardData = ref(null)

const stats = computed(() => {
    if (!dashboardData.value) return []

    const d = dashboardData.value
    return [
        {
            icon: '🏭',
            label: 'dashboard.todayProduction',
            value: `${d.today?.production?.batches || 0} batches, ${d.today?.production?.qty || 0} kg`
        },
        {
            icon: '💰',
            label: 'dashboard.todaySales',
            value: `₹${formatNumber(d.today?.sales?.amount || 0)}`
        },
        {
            icon: '📥',
            label: 'dashboard.todayPurchase',
            value: `${d.today?.purchase?.grns || 0} GRNs`
        },
        {
            icon: '📦',
            label: 'dashboard.rawMaterialStock',
            value: `${formatNumber(d.stock?.raw_materials?.qty || 0)} kg`
        },
        {
            icon: '🏷️',
            label: 'dashboard.finishedGoodsStock',
            value: `${formatNumber(d.stock?.finished_goods?.qty || 0)} kg`
        },
        {
            icon: '🚚',
            label: 'dashboard.pendingDeliveries',
            value: `${d.pending?.deliveries?.count || 0} deliveries`
        }
    ]
})

const productionData = computed(() => dashboardData.value?.charts?.monthly_production || [])
const salesData = computed(() => dashboardData.value?.charts?.monthly_sales || [])
const alerts = computed(() => dashboardData.value?.alerts || {})
const pendingData = computed(() => dashboardData.value?.pending?.orders || {})
const recentActivity = computed(() => dashboardData.value?.recent_activity || [])

const lowStockItems = computed(() => {
    if (!dashboardData.value?.alerts?.low_stock_items) return []
    return dashboardData.value.alerts.low_stock_items.slice(0, 10)
})

const maxProduction = computed(() => {
    return Math.max(...productionData.value.map(p => p.qty || 0), 1)
})

const maxSales = computed(() => {
    return Math.max(...salesData.value.map(s => s.amount || 0), 1)
})

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toFixed(0)
}

function formatTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return date.toLocaleDateString()
}

function getActivityIcon(action) {
    const icons = {
        created: '➕',
        updated: '✏️',
        deleted: '🗑️',
        approved: '✅',
        cancelled: '❌',
        login: '🔑',
        logout: '🔒'
    }
    return icons[action] || '📝'
}

async function loadDashboard() {
    loading.value = true
    try {
        const response = await api.get('/dashboard/summary', {
            params: { factory_id: localStorage.getItem('factoryId') }
        })
        if (response.data.success) {
            dashboardData.value = response.data.data
        }
    } catch (error) {
        console.error('Failed to load dashboard:', error)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadDashboard()
})
</script>

<style scoped>
.dashboard {
    padding: 16px;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.page-header h1 {
    font-size: 20px;
    font-weight: 600;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
}

.stat-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
}

.stat-icon {
    font-size: 32px;
}

.stat-value {
    font-size: 18px;
    font-weight: 600;
    font-family: var(--font-data);
}

.stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.dashboard-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
}

.dashboard-card .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light);
}

.dashboard-card .card-header h3 {
    font-size: var(--font-size-base);
    font-weight: 600;
}

.dashboard-card .card-body {
    padding: 16px;
}

.chart-placeholder {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 150px;
    gap: 8px;
}

.chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
}

.chart-bar {
    width: 100%;
    max-width: 30px;
    background: var(--primary);
    min-height: 4px;
    transition: height 0.3s;
}

.chart-bar.sales {
    background: var(--success);
}

.chart-label {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
}

.alert-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.alert-item {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: var(--danger-bg);
    font-size: var(--font-size-sm);
}

.alert-stock {
    color: var(--danger);
    font-weight: 500;
    font-family: var(--font-data);
}

.pending-info {
    text-align: center;
}

.pending-count {
    font-size: 32px;
    font-weight: 600;
    color: var(--warning);
}

.pending-amount {
    font-size: var(--font-size-lg);
    color: var(--text-muted);
    font-family: var(--font-data);
}

.activity-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.activity-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    font-size: var(--font-size-sm);
}

.activity-icon {
    font-size: 16px;
}

.activity-content {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.activity-action {
    font-weight: 500;
    text-transform: capitalize;
}

.activity-module {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
}

.activity-time {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
}

@media (max-width: 768px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
}
</style>
