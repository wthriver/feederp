<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Approvals</h1>
            <span class="badge badge-warning">{{ pendingCount }} Pending</span>
        </div>

        <div class="toolbar">
            <select v-model="activeTab" class="select-field">
                <option value="pending">Pending</option>
                <option value="history">History</option>
            </select>
            <select v-if="activeTab === 'history'" v-model="historyFilters.doc_type" class="select-field" @change="loadHistory">
                <option value="">All Types</option>
                <option value="purchase_order">Purchase Orders</option>
                <option value="sales_order">Sales Orders</option>
                <option value="production_batch">Production Batches</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <template v-else-if="activeTab === 'pending'">
            <div v-if="pendingApprovals.length === 0" class="empty-state">
                <p>No pending approvals</p>
            </div>
            <div v-else class="table-container">
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Document #</th>
                            <th>Party</th>
                            <th>Amount</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in pendingApprovals" :key="item.id">
                            <td><span :class="['badge', `badge-${item.doc_type}`]">{{ formatDocType(item.doc_type) }}</span></td>
                            <td class="font-mono">{{ item.doc_number }}</td>
                            <td>{{ item.party_name || '-' }}</td>
                            <td class="font-mono">৳{{ formatNumber(item.total_amount) }}</td>
                            <td>{{ formatDate(item.created_at) }}</td>
                            <td>
                                <button class="btn btn-sm" @click="approveItem(item)">✓</button>
                                <button class="btn btn-sm" @click="openRejectModal(item)">✕</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>

        <template v-else>
            <div v-if="history.length === 0" class="empty-state">
                <p>No history found</p>
            </div>
            <div v-else class="table-container">
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Document #</th>
                            <th>Action</th>
                            <th>Approver</th>
                            <th>Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in history" :key="item.id">
                            <td>{{ formatDate(item.created_at) }}</td>
                            <td>{{ formatDocType(item.document_type) }}</td>
                            <td class="font-mono">{{ item.document_number }}</td>
                            <td><span :class="['badge', item.action === 'approved' ? 'badge-success' : 'badge-danger']">{{ item.action }}</span></td>
                            <td>{{ item.approver_name }}</td>
                            <td>{{ item.comment || '-' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>

        <AppModal v-model="showRejectModal" title="Reject Document" size="sm" :loading="saving">
            <div class="form-group">
                <label class="form-label">Reason for rejection</label>
                <textarea v-model="rejectComment" class="input-field" rows="3"></textarea>
            </div>
            <template #footer>
                <button class="btn" @click="showRejectModal = false">Cancel</button>
                <button class="btn btn-danger" @click="confirmReject" :disabled="!rejectComment">Reject</button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const activeTab = ref('pending')
const pendingCount = ref(0)
const pendingApprovals = ref([])
const history = ref([])
const historyMeta = ref({ page: 1, total: 0, totalPages: 1 })
const historyFilters = ref({ doc_type: '' })
const showRejectModal = ref(false)
const rejectComment = ref('')
const selectedItem = ref(null)
const saving = ref(false)

async function loadPending() {
    loading.value = true
    try {
        const response = await api.get('/approvals/pending')
        if (response.data.success) {
            pendingApprovals.value = response.data.data
            pendingCount.value = response.data.meta?.total || 0
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function loadHistory(page = 1) {
    loading.value = true
    try {
        const response = await api.get('/approvals/history', {
            params: { page, doc_type: historyFilters.value.doc_type }
        })
        if (response.data.success) {
            history.value = response.data.data
            historyMeta.value = response.data.meta
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function approveItem(item) {
    try {
        await api.post(`/approvals/${item.doc_type}/${item.id}/approve`, {
            action: 'approve',
            comment: ''
        })
        window.showToast?.({ type: 'success', message: 'Document approved' })
        loadPending()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Approve failed' })
    }
}

function openRejectModal(item) {
    selectedItem.value = item
    rejectComment.value = ''
    showRejectModal.value = true
}

async function confirmReject() {
    if (!rejectComment.value) return
    saving.value = true
    try {
        await api.post(`/approvals/${selectedItem.value.doc_type}/${selectedItem.value.id}/approve`, {
            action: 'reject',
            comment: rejectComment.value
        })
        window.showToast?.({ type: 'success', message: 'Document rejected' })
        showRejectModal.value = false
        loadPending()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Reject failed' })
    } finally {
        saving.value = false
    }
}

function formatDocType(type) {
    const types = {
        purchase_order: 'PO',
        sales_order: 'SO',
        production_batch: 'Batch',
        stock_adjustment: 'Adjustment'
    }
    return types[type] || type
}

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

function formatDate(date) {
    return new Date(date).toLocaleDateString()
}

onMounted(() => {
    loadPending()
})
</script>

<style scoped>
.badge-purchase_order { background: #dbeafe; color: #1d4ed8; }
.badge-sales_order { background: #dcfce7; color: #16a34a; }
.badge-production_batch { background: #fef3c7; color: #d97706; }
.badge-stock_adjustment { background: #fce7f3; color: #db2777; }
</style>