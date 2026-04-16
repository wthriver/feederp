<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.workflowApprovals') || 'Workflow Approvals' }}</h1>
            <div class="header-actions">
                <select v-model="filter.status" class="select-field" @change="loadData">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="pendingApprovals.length > 0" class="pending-section">
            <h2 class="section-title">Pending Your Approval ({{ pendingApprovals.length }})</h2>
            <div class="approval-cards">
                <div v-for="item in pendingApprovals" :key="item.id" class="approval-card">
                    <div class="approval-header">
                        <span class="workflow-name">{{ item.workflow_name }}</span>
                        <span :class="['badge', getStatusClass(item.status)]">{{ item.status }}</span>
                    </div>
                    <div class="approval-body">
                        <div class="approval-info">
                            <span class="info-label">Entity:</span>
                            <span class="info-value">{{ item.entity_type }} #{{ item.entity_id?.substring(0, 8) }}</span>
                        </div>
                        <div class="approval-info">
                            <span class="info-label">Current Step:</span>
                            <span class="info-value">{{ item.current_step }}</span>
                        </div>
                        <div class="approval-info">
                            <span class="info-label">Submitted By:</span>
                            <span class="info-value">{{ item.created_by_name }}</span>
                        </div>
                    </div>
                    <div class="approval-actions">
                        <button class="btn btn-success btn-sm" @click="openApproveModal(item)">
                            Approve
                        </button>
                        <button class="btn btn-danger btn-sm" @click="openRejectModal(item)">
                            Reject
                        </button>
                        <button class="btn btn-sm" @click="viewDetails(item)">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-else class="empty-state-container">
            <EmptyState 
                icon="✅" 
                title="All Caught Up!" 
                description="No pending approvals at this time"
                size="medium"
            />
        </div>

        <div class="all-workflows">
            <h2 class="section-title">All Workflows</h2>
            <div class="table-container">
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th>Entity</th>
                            <th>Workflow</th>
                            <th>Current Step</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in data" :key="item.id">
                            <td>{{ item.entity_type }} #{{ item.entity_id?.substring(0, 8) }}</td>
                            <td>{{ item.workflow_name }}</td>
                            <td>{{ item.current_step }}</td>
                            <td><span :class="['badge', getStatusClass(item.status)]">{{ item.status }}</span></td>
                            <td>{{ formatDate(item.created_at) }}</td>
                            <td>
                                <button class="btn btn-sm" @click="viewDetails(item)">View</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <AppModal v-model="showDetailsModal" title="Workflow Details" size="lg">
            <div v-if="selectedWorkflow" class="workflow-details">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Entity Type:</label>
                            <span>{{ selectedWorkflow.entity_type }}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span :class="['badge', getStatusClass(selectedWorkflow.status)]">{{ selectedWorkflow.status }}</span>
                        </div>
                        <div class="detail-item">
                            <label>Current Step:</label>
                            <span>{{ selectedWorkflow.current_step }}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Workflow Steps</h4>
                    <div class="steps-timeline">
                        <div v-for="(step, idx) in selectedWorkflow.steps" :key="idx" 
                             class="step-item" :class="{ 'current': step.step === selectedWorkflow.current_step }">
                            <div class="step-indicator">
                                <span v-if="step.status === 'approved'" class="step-icon success">✓</span>
                                <span v-else-if="step.status === 'rejected'" class="step-icon danger">✗</span>
                                <span v-else class="step-icon pending">○</span>
                            </div>
                            <div class="step-content">
                                <div class="step-name">{{ step.name || step.step }}</div>
                                <div class="step-status">{{ step.status }}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>History</h4>
                    <div class="history-list">
                        <div v-for="(entry, idx) in selectedWorkflow.history" :key="idx" class="history-item">
                            <span class="history-action">{{ entry.action }}</span>
                            <span class="history-user">{{ entry.user_name }}</span>
                            <span class="history-date">{{ formatDateTime(entry.timestamp) }}</span>
                            <span v-if="entry.comment" class="history-comment">{{ entry.comment }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </AppModal>

        <AppModal v-model="showActionModal" :title="actionType === 'approve' ? 'Approve' : 'Reject'" size="sm">
            <div class="action-form">
                <div class="form-group">
                    <label class="form-label">Comment (optional)</label>
                    <textarea v-model="actionComment" class="input-field" rows="3" 
                              :placeholder="actionType === 'approve' ? 'Add approval notes...' : 'Reason for rejection...'"></textarea>
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="showActionModal = false">Cancel</button>
                <button class="btn" :class="actionType === 'approve' ? 'btn-success' : 'btn-danger'" 
                        @click="submitAction" :disabled="submitting">
                    {{ submitting ? 'Processing...' : (actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject') }}
                </button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(false)
const submitting = ref(false)
const data = ref([])
const pendingApprovals = ref([])
const filter = reactive({ status: '' })
const meta = reactive({ page: 1, total: 0 })

const showDetailsModal = ref(false)
const showActionModal = ref(false)
const selectedWorkflow = ref(null)
const actionType = ref('')
const actionComment = ref('')

function getStatusClass(status) {
    const classes = {
        pending: 'badge-warning',
        in_review: 'badge-info',
        approved: 'badge-success',
        rejected: 'badge-danger',
        cancelled: 'badge-secondary'
    }
    return classes[status] || 'badge-secondary'
}

function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
}

async function loadData() {
    loading.value = true
    try {
        const params = { page: meta.page, ...filter }
        const response = await api.get('/workflow/instances', { params })
        if (response.data.success) {
            data.value = response.data.data
            meta.total = response.data.meta?.total || data.value.length
        }

        const pendingResponse = await api.get('/workflow/my-pending')
        if (pendingResponse.data.success) {
            pendingApprovals.value = pendingResponse.data.data
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function loadDefinitions() {
    try {
        const response = await api.get('/workflow/definitions')
        if (response.data.success) {
            return response.data.data
        }
    } catch (error) {
        console.error(error)
    }
    return []
}

async function viewDetails(item) {
    selectedWorkflow.value = item
    showDetailsModal.value = true
}

function openApproveModal(item) {
    selectedWorkflow.value = item
    actionType.value = 'approve'
    actionComment.value = ''
    showActionModal.value = true
}

function openRejectModal(item) {
    selectedWorkflow.value = item
    actionType.value = 'reject'
    actionComment.value = ''
    showActionModal.value = true
}

async function submitAction() {
    submitting.value = true
    try {
        const response = await api.post(`/workflow/instances/${selectedWorkflow.value.id}/action`, {
            action: actionType.value,
            comment: actionComment.value
        })
        
        if (response.data.success) {
            window.showToast?.({ type: 'success', message: response.data.message })
            showActionModal.value = false
            loadData()
        }
    } catch (error) {
        window.showToast?.({ type: 'error', message: error.response?.data?.error?.message || 'Action failed' })
    } finally {
        submitting.value = false
    }
}

onMounted(loadData)
</script>

<style scoped>
.pending-section {
    margin-bottom: 2rem;
}

.section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text-primary);
}

.approval-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
}

.approval-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 8px;
    padding: 1rem;
}

.approval-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.workflow-name {
    font-weight: 600;
    color: var(--text-primary);
}

.approval-body {
    margin-bottom: 1rem;
}

.approval-info {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
}

.info-label {
    color: var(--text-muted);
}

.info-value {
    color: var(--text-primary);
}

.approval-actions {
    display: flex;
    gap: 0.5rem;
}

.all-workflows {
    margin-top: 2rem;
}

.workflow-details {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.detail-section h4 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--text-primary);
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
}

.detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.detail-item label {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.steps-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.step-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
}

.step-item.current {
    background: var(--bg-secondary);
}

.step-indicator {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
}

.step-icon.success {
    background: var(--success);
    color: white;
}

.step-icon.danger {
    background: var(--danger);
    color: white;
}

.step-icon.pending {
    border: 2px solid var(--border-light);
}

.step-content {
    flex: 1;
}

.step-name {
    font-weight: 500;
}

.step-status {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.history-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 4px;
}

.history-action {
    font-weight: 500;
}

.history-date {
    color: var(--text-muted);
}

.history-comment {
    width: 100%;
    margin-top: 0.25rem;
    font-style: italic;
    color: var(--text-muted);
}

.action-form .form-group {
    margin-bottom: 0;
}
</style>
