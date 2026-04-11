<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.returns') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Return</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Return #</th>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Amount</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.return_number }}</td>
                        <td>{{ item.return_date }}</td>
                        <td class="font-mono">{{ item.invoice_number }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td class="text-center">{{ item.item_count }}</td>
                        <td class="font-mono">₹{{ item.total_amount?.toLocaleString() }}</td>
                        <td>{{ item.reason || '-' }}</td>
                        <td><span :class="['badge', statusClass(item.status)]">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="approve(item)">✅</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="reject(item)">❌</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="9" class="text-center text-muted">No returns found</td>
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

        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">Sales Return</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-3">
                        <div class="form-group">
                            <label class="form-label">Invoice *</label>
                            <select v-model="form.invoice_id" class="select-field" required @change="onInvoiceChange">
                                <option value="">Select Invoice</option>
                                <option v-for="inv in invoices" :key="inv.id" :value="inv.id">{{ inv.invoice_number }} - {{ inv.customer_name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Return Date *</label>
                            <input v-model="form.return_date" type="date" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Customer</label>
                            <input v-model="form.customer_name" type="text" class="input-field" readonly />
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="section-header">
                            <h4>Return Items</h4>
                            <button type="button" class="btn btn-sm" @click="addItem" :disabled="!form.invoice_id">+ Add Item</button>
                        </div>
                        <table class="sheet-grid">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Invoice Qty</th>
                                    <th>Return Qty</th>
                                    <th>Rate</th>
                                    <th>Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in form.items" :key="idx">
                                    <td>
                                        <select v-model="item.product_id" class="select-field" @change="selectProduct(item)">
                                            <option value="">Select</option>
                                            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                                        </select>
                                    </td>
                                    <td class="font-mono text-right">{{ item.invoice_qty || '-' }}</td>
                                    <td><input v-model.number="item.quantity" type="number" class="input-field" @input="calcAmount(item)" /></td>
                                    <td><input v-model.number="item.rate" type="number" class="input-field" step="0.01" @input="calcAmount(item)" /></td>
                                    <td class="font-mono">₹{{ ((item.quantity || 0) * (item.rate || 0)).toLocaleString() }}</td>
                                    <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" class="text-right"><strong>Total:</strong></td>
                                    <td class="font-mono"><strong>₹{{ totalAmount.toLocaleString() }}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Reason *</label>
                            <select v-model="form.reason" class="select-field" required>
                                <option value="">Select Reason</option>
                                <option value="damaged">Damaged</option>
                                <option value="wrong_item">Wrong Item</option>
                                <option value="quality_issue">Quality Issue</option>
                                <option value="expired">Expired</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="closeModal">{{ $t('common.cancel') }}</button>
                    <button class="btn btn-primary" @click="save">{{ $t('common.save') }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const invoices = ref([])
const products = ref([])
const showModal = ref(false)
const filter = reactive({ search: '', status: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })

const form = reactive({
    invoice_id: '', return_date: new Date().toISOString().slice(0, 10), customer_id: '',
    customer_name: '', items: [], reason: '', notes: ''
})

const totalAmount = computed(() => form.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0))

function statusClass(status) {
    const classes = { pending: 'badge-warning', approved: 'badge-info', completed: 'badge-success', rejected: 'badge-danger' }
    return classes[status] || 'badge-secondary'
}

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/sales/returns', { params: { ...filter, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadInvoices() {
    try {
        const response = await api.get('/sales/invoices')
        if (response.data.success) invoices.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadProducts() {
    try {
        const response = await api.get('/master/products')
        if (response.data.success) products.value = response.data.data
    } catch (error) { console.error(error) }
}

function onInvoiceChange() {
    const inv = invoices.value.find(i => i.id === form.invoice_id)
    if (inv) {
        form.customer_id = inv.customer_id
        form.customer_name = inv.customer_name
        form.items = []
    }
}

function addItem() { form.items.push({ product_id: '', invoice_qty: 0, quantity: 1, rate: 0 }) }
function removeItem(idx) { form.items.splice(idx, 1) }

function selectProduct(item) {
    const p = products.value.find(pr => pr.id === item.product_id)
    if (p) {
        item.rate = p.opening_rate || p.mrp || 0
    }
}

function calcAmount(item) { /* auto */ }

function openModal() {
    Object.assign(form, { invoice_id: '', return_date: new Date().toISOString().slice(0, 10), customer_id: '', customer_name: '', items: [], reason: '', notes: '' })
    showModal.value = true
}

async function view(item) { console.log(item) }

async function approve(item) {
    try {
        await api.post(`/sales/returns/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Return approved' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function reject(item) {
    try {
        await api.post(`/sales/returns/${item.id}/reject`)
        window.showToast?.({ type: 'success', message: 'Return rejected' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    if (!form.invoice_id || !form.reason || form.items.length === 0) {
        window.showToast?.({ type: 'error', message: 'Please fill required fields' })
        return
    }
    try {
        await api.post('/sales/returns', form)
        window.showToast?.({ type: 'success', message: 'Return saved' })
        closeModal()
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

function closeModal() { showModal.value = false }

onMounted(() => { loadData(); loadInvoices(); loadProducts() })
</script>

<style scoped>
.items-section { margin-top: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; }
.items-section table { margin-top: 8px; }
.items-section table th, .items-section table td { padding: 6px; }
.items-section table .input-field, .items-section table .select-field { width: 100%; padding: 4px 8px; font-size: var(--font-size-sm); }
</style>
