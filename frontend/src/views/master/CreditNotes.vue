<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Credit Notes</h1>
            <button class="btn btn-primary" @click="openModal()">+ Create</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No credit notes found.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Note No</th>
                        <th>Type</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.note_number }}</td>
                        <td>{{ item.note_type }}</td>
                        <td>{{ item.customer_name || '-' }}</td>
                        <td class="font-mono">৳{{ item.total_amount }}</td>
                        <td>{{ item.invoice_number || '-' }}</td>
                        <td>{{ item.note_date }}</td>
                        <td>
                            <span :class="['badge', item.status === 'approved' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning']">
                                {{ item.status || 'pending' }}
                            </span>
                        </td>
                        <td>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="approve(item)" title="Approve">✓</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" title="Create Credit Note" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group span-2">
                    <label class="form-label">Customer *</label>
                    <select v-model="form.customer_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select v-model="form.note_type" class="select-field">
                        <option value="sales_return">Return</option>
                        <option value="discount">Discount</option>
                        <option value="adjustment">Adjustment</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount *</label>
                    <input v-model="form.total_amount" type="number" class="input-field" />
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Reason</label>
                <textarea v-model="form.reason" class="input-field" rows="2"></textarea>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Invoice #</label>
                    <input v-model="form.invoice_number" class="input-field" />
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="save">Create</button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const customers = ref([])
const showModal = ref(false)

const form = reactive({ customer_id: '', note_type: 'sales_return', reason: '', total_amount: '', invoice_number: '' })

async function loadData() {
    loading.value = true
    try {
        const [notesRes, customersRes] = await Promise.all([
            api.get('/master/credit-notes'),
            api.get('/master/customers')
        ])
        if (notesRes.data.success) data.value = notesRes.data.data
        if (customersRes.data.success) customers.value = customersRes.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    Object.assign(form, { customer_id: '', note_type: 'sales_return', reason: '', total_amount: '', invoice_number: '' })
    showModal.value = true
}

async function save() {
    if (!form.customer_id || !form.total_amount) {
        window.showToast?.({ type: 'error', message: 'Customer and amount required' })
        return
    }
    saving.value = true
    try {
        await api.post('/master/credit-notes', form)
        window.showToast?.({ type: 'success', message: 'Created successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed to create' })
    } finally {
        saving.value = false
    }
}

async function approve(item) {
    try {
        await api.post(`/master/credit-notes/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Approved' })
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed' })
    }
}

onMounted(loadData)
</script>