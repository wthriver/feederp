<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.activityLog') }}</h1>
        </div>

        <div class="toolbar">
            <select v-model="filter.module" class="select-field" @change="loadData">
                <option value="">All Modules</option>
                <option v-for="m in modules" :key="m" :value="m">{{ m }}</option>
            </select>
            <input v-model="filter.from_date" type="date" class="input-field" @change="loadData" />
            <input v-model="filter.to_date" type="date" class="input-field" @change="loadData" />
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>User</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th>Record ID</th>
                        <th>IP Address</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ formatDateTime(item.created_at) }}</td>
                        <td>{{ item.user_name }}</td>
                        <td><span class="badge badge-secondary">{{ item.module }}</span></td>
                        <td><span :class="['badge', actionClass(item.action)]">{{ item.action }}</span></td>
                        <td class="font-mono">{{ item.record_id?.substring(0, 8) }}...</td>
                        <td class="font-mono">{{ item.ip_address }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="meta.page--; loadData()">◄</button>
                <span>Page {{ meta.page }}</span>
                <button class="pagination-btn" :disabled="meta.page >= meta.totalPages" @click="meta.page++; loadData()">►</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const filter = reactive({ module: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 1 })

const modules = ['auth', 'master', 'purchase', 'inventory', 'production', 'quality', 'sales', 'finance', 'transport', 'barcode', 'admin']

function actionClass(action) {
    const classes = { created: 'badge-success', updated: 'badge-info', deleted: 'badge-danger', approved: 'badge-success', cancelled: 'badge-warning', login: 'badge-secondary', logout: 'badge-secondary' }
    return classes[action] || 'badge-secondary'
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString()
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/admin/activity-log', { params: { ...filter, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            if (response.data.meta) {
                meta.total = response.data.meta.total || data.value.length
                meta.totalPages = response.data.meta.totalPages || 1
            }
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

onMounted(loadData)
</script>
