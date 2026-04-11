<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.salesOrders') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Order</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
            </select>
            <input v-model="filter.from_date" type="date" class="input-field" @change="loadData" />
            <input v-model="filter.to_date" type="date" class="input-field" @change="loadData" />
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Gross</th>
                        <th>Tax</th>
                        <th>Net Amount</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.order_number }}</td>
                        <td>{{ item.order_date }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td class="text-center">{{ item.item_count }}</td>
                        <td class="font-mono text-right">₹{{ item.gross_amount?.toLocaleString() }}</td>
                        <td class="font-mono text-right">₹{{ item.tax_amount?.toLocaleString() }}</td>
                        <td class="font-mono text-right">₹{{ item.net_amount?.toLocaleString() }}</td>
                        <td><span :class="['badge', statusClass(item.status)]">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="confirmOrder(item)">✅</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="cancelOrder(item)">❌</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="9" class="text-center text-muted">No orders found</td>
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
            <div class="modal" style="max-width: 900px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'New' }} Sales Order</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-3">
                        <div class="form-group" :class="{ 'has-error': errors.customer_id }">
                            <label class="form-label">Customer *</label>
                            <select v-model="form.customer_id" class="select-field" :class="{ 'is-invalid': errors.customer_id }" @blur="touchField('customer_id')">
                                <option value="">Select Customer</option>
                                <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                            </select>
                            <span v-if="errors.customer_id" class="error-message">{{ errors.customer_id }}</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Order Date *</label>
                            <input v-model="form.order_date" type="date" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Expected Delivery</label>
                            <input v-model="form.expected_date" type="date" class="input-field" />
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="section-header">
                            <h4>Items</h4>
                            <button type="button" class="btn btn-sm" @click="addItem">+ Add Item</button>
                        </div>
                        <div v-if="errors.items" class="error-message" style="margin-bottom: 8px;">{{ errors.items }}</div>
                        <table class="sheet-grid">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
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
                                    <td>{{ item.unit_name }}</td>
                                    <td><input v-model.number="item.rate" type="number" class="input-field" step="0.01" @input="calcAmount(item)" /></td>
                                    <td class="font-mono">₹{{ ((item.quantity || 0) * (item.rate || 0)).toLocaleString() }}</td>
                                    <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" class="text-right"><strong>Gross Total:</strong></td>
                                    <td class="font-mono"><strong>₹{{ grossAmount.toLocaleString() }}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Tax (%)</label>
                            <input v-model.number="form.tax_percent" type="number" class="input-field" step="0.01" @input="calcTotals" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Net Amount</label>
                            <div class="input-field font-mono" style="padding: 8px 12px; background: var(--bg-secondary);">₹{{ netAmount.toLocaleString() }}</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="closeModal" :disabled="saving">{{ $t('common.cancel') }}</button>
                    <button class="btn btn-primary" :class="{ loading: saving }" @click="save" :disabled="saving">
                        {{ saving ? 'Saving...' : $t('common.save') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const customers = ref([])
const products = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })
const errors = reactive({})
const touched = reactive({})

const form = reactive({
    customer_id: '', order_date: new Date().toISOString().slice(0, 10), expected_date: '',
    items: [], notes: '', tax_percent: 18
})

const grossAmount = computed(() => form.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0))
const netAmount = computed(() => grossAmount.value * (1 + (form.tax_percent || 0) / 100))

function statusClass(status) {
    const classes = { pending: 'badge-warning', confirmed: 'badge-info', processing: 'badge-primary', dispatched: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger' }
    return classes[status] || 'badge-secondary'
}

function touchField(field) {
    touched[field] = true
    validateField(field)
}

function validateField(field) {
    if (field === 'customer_id') {
        if (!form.customer_id) {
            errors.customer_id = 'Please select a customer'
        } else {
            delete errors.customer_id
        }
    }
    if (field === 'items') {
        if (form.items.length === 0) {
            errors.items = 'Please add at least one item'
        } else {
            const hasValidItems = form.items.some(item => item.product_id && item.quantity > 0)
            if (!hasValidItems) {
                errors.items = 'Please fill in all item details'
            } else {
                delete errors.items
            }
        }
    }
}

function validateAll() {
    errors.customer_id = !form.customer_id ? 'Please select a customer' : ''
    errors.items = form.items.length === 0 ? 'Please add at least one item' : ''
    const hasValidItems = form.items.some(item => item.product_id && item.quantity > 0)
    if (!hasValidItems && form.items.length > 0) {
        errors.items = 'Please fill in all item details'
    }
    return !errors.customer_id && !errors.items
}

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/sales/orders', { params: { ...filter, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
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

function addItem() {
    form.items.push({ product_id: '', quantity: 1, unit_id: '', unit_name: '', rate: 0 })
}

function removeItem(idx) { form.items.splice(idx, 1) }

function selectProduct(item) {
    const p = products.value.find(pr => pr.id === item.product_id)
    if (p) {
        item.unit_id = p.unit_id
        item.unit_name = p.unit_name
        item.rate = p.opening_rate || p.mrp || 0
    }
}

function calcAmount(item) { /* auto */ }
function calcTotals() { /* auto */ }

function openModal() {
    editing.value = null
    Object.assign(form, {
        customer_id: '', order_date: new Date().toISOString().slice(0, 10), expected_date: '',
        items: [], notes: '', tax_percent: 18
    })
    Object.assign(errors, {})
    Object.assign(touched, {})
    showModal.value = true
}

async function view(item) {
    try {
        const response = await api.get(`/sales/orders/${item.id}`)
        if (response.data.success) {
            console.log(response.data.data)
        }
    } catch (error) { console.error(error) }
}

async function confirmOrder(item) {
    try {
        await api.post(`/sales/orders/${item.id}/confirm`)
        window.showToast?.({ type: 'success', message: 'Order confirmed' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function cancelOrder(item) {
    try {
        await api.post(`/sales/orders/${item.id}/cancel`)
        window.showToast?.({ type: 'success', message: 'Order cancelled' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    touched.customer_id = true
    touched.items = true
    validateAll()
    
    if (!form.customer_id || form.items.length === 0) {
        return
    }
    
    const hasValidItems = form.items.some(item => item.product_id && item.quantity > 0)
    if (!hasValidItems) {
        return
    }
    
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/sales/orders/${editing.value.id}`, form)
        } else {
            await api.post('/sales/orders', form)
        }
        window.showToast?.({ type: 'success', message: 'Order saved' })
        closeModal()
        loadData()
    } catch (error) { 
        window.showToast?.({ type: 'error', message: 'Save failed: ' + (error.response?.data?.error?.message || error.message) }) 
    } finally {
        saving.value = false
    }
}

function closeModal() {
    showModal.value = false
    editing.value = null
    Object.assign(errors, {})
    Object.assign(touched, {})
}

onMounted(() => { loadData(); loadCustomers(); loadProducts() })
</script>

<style scoped>
.items-section { margin-top: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; }
.items-section table { margin-top: 8px; }
.items-section table th, .items-section table td { padding: 6px; }
.items-section table .input-field, .items-section table .select-field { width: 100%; padding: 4px 8px; font-size: var(--font-size-sm); }
</style>
