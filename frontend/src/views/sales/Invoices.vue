<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.invoices') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Invoice</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
            </select>
            <input v-model="filter.from_date" type="date" class="input-field" @change="loadData" />
            <input v-model="filter.to_date" type="date" class="input-field" @change="loadData" />
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Order #</th>
                        <th>Amount</th>
                        <th>Paid</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.invoice_number }}</td>
                        <td>{{ item.invoice_date }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td class="font-mono">{{ item.order_number }}</td>
                        <td class="font-mono">₹{{ item.net_amount?.toLocaleString() }}</td>
                        <td class="font-mono text-success">₹{{ item.amount_paid?.toLocaleString() }}</td>
                        <td class="font-mono text-danger">₹{{ item.amount_due?.toLocaleString() }}</td>
                        <td><span :class="['badge', paymentBadge(item.payment_status)]">{{ item.payment_status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="viewInvoice(item)">👁️</button>
                            <button v-if="item.amount_due > 0" class="btn btn-sm btn-icon" @click="recordPayment(item)">💰</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">New Invoice</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Customer *</label>
                            <select v-model="form.customer_id" class="select-field" required>
                                <option value="">Select Customer</option>
                                <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Invoice Date *</label>
                            <input v-model="form.invoice_date" type="date" class="input-field" required />
                        </div>
                    </div>
                    <div class="items-section">
                        <div class="section-header">
                            <h4>Items</h4>
                            <button type="button" class="btn btn-sm" @click="addItem">+ Add Item</button>
                        </div>
                        <table class="sheet-grid">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
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
                                    <td><input v-model.number="item.quantity" type="number" class="input-field" @input="calcAmount(item)" /></td>
                                    <td><input v-model.number="item.rate" type="number" class="input-field" @input="calcAmount(item)" /></td>
                                    <td class="font-mono">₹{{ ((item.quantity || 0) * (item.rate || 0)).toLocaleString() }}</td>
                                    <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
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
const customers = ref([])
const products = ref([])
const showModal = ref(false)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({ customer_id: '', invoice_date: new Date().toISOString().slice(0, 10), items: [], notes: '' })
const errors = reactive({})
const touched = reactive({})

function validateField(field) {
    if (field === 'customer_id') {
        errors.customer_id = !form.customer_id ? 'Please select a customer' : ''
    }
    if (field === 'items') {
        const hasValidItems = form.items.some(item => item.product_id && item.quantity > 0)
        errors.items = (!hasValidItems && form.items.length > 0) ? 'Please fill in all item details' : ''
    }
}

function validateAll() {
    errors.customer_id = !form.customer_id ? 'Please select a customer' : ''
    const hasValidItems = form.items.some(item => item.product_id && item.quantity > 0)
    errors.items = form.items.length === 0 ? 'Please add at least one item' : (!hasValidItems ? 'Please fill in all item details' : '')
    return !errors.customer_id && !errors.items
}

function paymentBadge(status) {
    const classes = { pending: 'badge-danger', partial: 'badge-warning', paid: 'badge-success' }
    return classes[status] || 'badge-secondary'
}

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/sales/invoices', { params: filter })
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadCustomers() {
    try {
        const response = await api.get('/sales/customers')
        if (response.data.success) customers.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadProducts() {
    try {
        const response = await api.get('/master/products')
        if (response.data.success) products.value = response.data.data
    } catch (error) { console.error(error) }
}

function openModal() {
    form.items = []
    showModal.value = true
}

function addItem() { form.items.push({ product_id: '', quantity: 0, rate: 0, amount: 0 }) }
function removeItem(idx) { form.items.splice(idx, 1) }

function selectProduct(item) {
    const p = products.value.find(prod => prod.id === item.product_id)
    if (p) item.rate = p.mrp || 0
}

function calcAmount(item) { item.amount = (item.quantity || 0) * (item.rate || 0) }

function viewInvoice(item) { console.log('View', item) }

async function recordPayment(item) {
    const amount = prompt('Enter payment amount:', item.amount_due)
    if (!amount) return
    try {
        await api.post(`/sales/invoices/${item.id}/payment`, { amount: parseFloat(amount), payment_mode: 'bank' })
        window.showToast?.({ type: 'success', message: 'Payment recorded' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    touched.customer_id = true
    touched.items = true
    if (!validateAll()) return
    
    try {
        await api.post('/sales/invoices', form)
        window.showToast?.({ type: 'success', message: 'Invoice created' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed: ' + (error.response?.data?.error?.message || error.message) }) }
}

onMounted(() => { loadData(); loadCustomers(); loadProducts() })
</script>

<style scoped>
.items-section { margin-top: 16px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.items-section table th, .items-section table td { padding: 6px; }
.items-section table .input-field, .items-section table .select-field { width: 100%; padding: 4px 8px; font-size: var(--font-size-sm); }
</style>
