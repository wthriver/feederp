<template>
    <div class="data-page">
        <div class="page-header">
            <div class="page-header-left">
                <h1>{{ $t('nav.salesOrders') }}</h1>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" @click="openModal()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Order
                </button>
            </div>
        </div>

        <div class="toolbar">
            <div class="search-box">
                <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            </div>

            <div class="filter-group">
                <select v-model="filter.status" class="toolbar-select" @change="loadData">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            <div class="divider-v"></div>

            <div class="filter-group">
                <input v-model="filter.from_date" type="date" class="toolbar-input" @change="loadData" />
                <span class="date-sep">to</span>
                <input v-model="filter.to_date" type="date" class="toolbar-input" @change="loadData" />
            </div>

            <div class="spacer"></div>

            <button class="btn btn-sm" @click="loadData" title="Refresh">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
            </button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th class="num">Items</th>
                        <th class="num">Net Amount</th>
                        <th>Status</th>
                        <th style="width: 100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id" @click="view(item)" style="cursor: pointer;">
                        <td class="mono">{{ item.order_number }}</td>
                        <td>{{ formatDate(item.order_date) }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td class="num">{{ item.item_count }}</td>
                        <td class="num">৳{{ formatNumber(item.net_amount) }}</td>
                        <td><span :class="['badge', statusClass(item.status)]">{{ item.status }}</span></td>
                        <td>
                            <div class="action-cell">
                                <button class="action-btn" @click.stop="view(item)" title="View">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                                <button class="action-btn" @click.stop="confirmOrder(item)" v-if="item.status === 'pending'" title="Confirm">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                                <button class="action-btn danger" @click.stop="cancelOrder(item)" v-if="item.status === 'pending'" title="Cancel">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="7" class="text-center text-muted" style="padding: 40px;">No orders found</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Showing {{ data.length }} of {{ meta.total }} orders</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="meta.page--; loadData()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <span class="page-info">Page {{ meta.page }} of {{ meta.totalPages || 1 }}</span>
                <button class="pagination-btn" :disabled="meta.page >= meta.totalPages" @click="meta.page++; loadData()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Sales Order' : 'New Sales Order'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Order #</label>
                    <input type="text" class="input-field" :value="form.order_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group span-2" :class="{ 'has-error': errors.customer_id }">
                    <label class="form-label">Customer *</label>
                    <select v-model="form.customer_id" class="select-field" :class="{ 'is-invalid': errors.customer_id }" @change="onCustomerChange" @blur="touchField('customer_id')">
                        <option value="">Select</option>
                        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                    <span v-if="errors.customer_id" class="error-message">{{ errors.customer_id }}</span>
                </div>
                <div class="form-group">
                    <label class="form-label">Reference</label>
                    <input v-model="form.reference_number" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select v-model="form.priority" class="select-field">
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Terms</label>
                    <select v-model="form.payment_terms" class="select-field">
                        <option value="">Select</option>
                        <option value="immediate">Immediate</option>
                        <option value="net15">Net 15</option>
                        <option value="net30">Net 30</option>
                        <option value="net45">Net 45</option>
                        <option value="net60">Net 60</option>
                    </select>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Order Date *</label>
                    <input v-model="form.order_date" type="date" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Delivery Date</label>
                    <input v-model="form.expected_date" type="date" class="input-field" />
                </div>
                <div class="form-group span-4">
                    <label class="form-label">Delivery Address</label>
                    <input v-model="form.delivery_address" type="text" class="input-field" />
                </div>
            </div>

            <div v-if="selectedCustomer" class="info-grid">
                <div class="info-item">
                    <span class="info-label">Contact</span>
                    <span class="info-value">{{ selectedCustomer.contact_person || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone</span>
                    <span class="info-value">{{ selectedCustomer.phone || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-value">{{ selectedCustomer.email || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Credit Limit</span>
                    <span class="info-value">৳{{ formatNumber(selectedCustomer.credit_limit) }}</span>
                </div>
            </div>

            <div class="items-section">
                <div class="section-header">
                    <h4>Items</h4>
                    <button type="button" class="btn btn-sm" @click="addItem">+ Add</button>
                </div>
                <div v-if="errors.items" class="error-message" style="margin-bottom: 6px;">{{ errors.items }}</div>
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Product</th>
                            <th style="width: 70px;">Qty</th>
                            <th style="width: 60px;">Unit</th>
                            <th style="width: 90px;">Rate</th>
                            <th style="width: 60px;">Disc %</th>
                            <th style="width: 60px;">Tax %</th>
                            <th style="width: 100px;">Amount</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in form.items" :key="idx">
                            <td class="text-center">{{ idx + 1 }}</td>
                            <td>
                                <select v-model="item.product_id" class="table-select" @change="selectProduct(item)">
                                    <option value="">Select</option>
                                    <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                                </select>
                            </td>
                            <td><input v-model.number="item.quantity" type="number" class="table-input text-right" min="0" @input="calcItemAmount(item)" /></td>
                            <td>
                                <select v-model="item.unit_id" class="table-select" @change="updateUnitName(item)">
                                    <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                                </select>
                            </td>
                            <td><input v-model.number="item.rate" type="number" class="table-input text-right" min="0" step="0.01" @input="calcItemAmount(item)" /></td>
                            <td><input v-model.number="item.discount_percent" type="number" class="table-input text-right" min="0" max="100" @input="calcItemAmount(item)" /></td>
                            <td><input v-model.number="item.tax_percent" type="number" class="table-input text-right" min="0" max="100" @input="calcItemAmount(item)" /></td>
                            <td class="font-mono text-right">৳{{ item.amount?.toLocaleString() }}</td>
                            <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-right"><strong>Sub Total:</strong></td>
                            <td class="font-mono text-right"><strong>৳{{ grossAmount.toLocaleString() }}</strong></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="7" class="text-right">Discount:</td>
                            <td class="font-mono text-right">(-) ৳{{ form.discount_amount?.toLocaleString() || 0 }}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="7" class="text-right">Tax:</td>
                            <td class="font-mono text-right">(+) ৳{{ form.tax_amount?.toLocaleString() || 0 }}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="7" class="text-right">Shipping:</td>
                            <td><input v-model.number="form.shipping_cost" type="number" class="table-input text-right" min="0" @input="calcTotals" /></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="7" class="text-right"><strong>Total:</strong></td>
                            <td class="font-mono text-right"><strong>৳{{ netAmount.toLocaleString() }}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="form-row-4" style="margin-top: 8px;">
                <div class="form-group span-3">
                    <label class="form-label">Terms</label>
                    <textarea v-model="form.terms" class="input-field" rows="2"></textarea>
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Notes</label>
                    <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal" :disabled="saving">{{ $t('common.cancel') }}</button>
                <button class="btn btn-secondary" @click="saveDraft" :disabled="saving">Save as Draft</button>
                <button class="btn btn-primary" :class="{ loading: saving }" @click="save" :disabled="saving">
                    {{ saving ? 'Saving...' : $t('common.save') }}
                </button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const customers = ref([])
const products = ref([])
const units = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })
const errors = reactive({})
const touched = reactive({})

const form = reactive({
    customer_id: '',
    order_number: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    priority: 'normal',
    reference_number: '',
    delivery_address: '',
    payment_terms: '',
    items: [],
    terms: '',
    notes: '',
    discount_amount: 0,
    tax_amount: 0,
    shipping_cost: 0,
    status: 'pending'
})

const selectedCustomer = computed(() => customers.value.find(c => c.id === form.customer_id))

const grossAmount = computed(() => form.items.reduce((sum, item) => sum + (item.amount || 0), 0))
const netAmount = computed(() => grossAmount.value - (form.discount_amount || 0) + (form.tax_amount || 0) + (form.shipping_cost || 0))

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

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

async function loadUnits() {
    try {
        const response = await api.get('/master/units')
        if (response.data.success) units.value = response.data.data
    } catch (error) { console.error(error) }
}

function onCustomerChange() {
    if (selectedCustomer.value && selectedCustomer.value.default_payment_terms) {
        form.payment_terms = selectedCustomer.value.default_payment_terms
    }
}

function addItem() {
    form.items.push({
        product_id: '',
        description: '',
        quantity: 0,
        unit_id: '',
        unit_name: '',
        rate: 0,
        discount_percent: 0,
        tax_percent: 0,
        amount: 0
    })
}

function removeItem(idx) {
    form.items.splice(idx, 1)
    calcTotals()
}

function selectProduct(item) {
    const p = products.value.find(pr => pr.id === item.product_id)
    if (p) {
        item.unit_id = p.unit_id
        item.unit_name = p.unit_name || p.unit_code
        item.rate = p.opening_rate || p.mrp || 0
        item.tax_percent = p.tax_rate || 0
        calcItemAmount(item)
    }
}

function updateUnitName(item) {
    const u = units.value.find(unit => unit.id === item.unit_id)
    if (u) {
        item.unit_name = u.code
    }
}

function calcItemAmount(item) {
    const qty = item.quantity || 0
    const rate = item.rate || 0
    const disc = item.discount_percent || 0
    const tax = item.tax_percent || 0
    
    const subtotal = qty * rate
    const afterDiscount = subtotal - (subtotal * disc / 100)
    const afterTax = afterDiscount + (afterDiscount * tax / 100)
    
    item.amount = afterTax
    calcTotals()
}

function calcTotals() {
    const subtotal = grossAmount.value
    form.tax_amount = subtotal
}

function openModal() {
    editing.value = null
    form.customer_id = ''
    form.order_number = ''
    form.order_date = new Date().toISOString().slice(0, 10)
    form.expected_date = ''
    form.priority = 'normal'
    form.reference_number = ''
    form.delivery_address = ''
    form.payment_terms = ''
    form.items = []
    form.terms = ''
    form.notes = ''
    form.discount_amount = 0
    form.tax_amount = 0
    form.shipping_cost = 0
    form.status = 'pending'
    Object.assign(errors, {})
    Object.assign(touched, {})
    showModal.value = true
}

async function view(item) {
    try {
        const response = await api.get(`/sales/orders/${item.id}`)
        if (response.data.success) {
            const order = response.data.data
            editing.value = order
            form.customer_id = order.customer_id
            form.order_number = order.order_number
            form.order_date = order.order_date
            form.expected_date = order.expected_date || ''
            form.priority = order.priority || 'normal'
            form.reference_number = order.reference_number || ''
            form.delivery_address = order.delivery_address || ''
            form.payment_terms = order.payment_terms || ''
            form.notes = order.notes || ''
            form.terms = order.terms || ''
            form.discount_amount = order.discount_amount || 0
            form.tax_amount = order.tax_amount || 0
            form.shipping_cost = order.shipping_cost || 0
            form.status = order.status || 'pending'
            form.items = order.items?.map(item => ({
                product_id: item.product_id,
                description: item.description || '',
                quantity: item.quantity,
                unit_id: item.unit_id,
                unit_name: item.unit_name || '',
                rate: item.rate || 0,
                discount_percent: item.discount_percent || 0,
                tax_percent: item.tax_percent || 0,
                amount: item.amount || 0
            })) || []
            showModal.value = true
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

async function saveDraft() {
    form.status = 'pending'
    await save()
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
        const payload = { ...form, status: form.status || 'pending' }
        if (editing.value) {
            await api.put(`/sales/orders/${editing.value.id}`, payload)
        } else {
            await api.post('/sales/orders', payload)
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

onMounted(() => { loadData(); loadCustomers(); loadProducts(); loadUnits() })
</script>

<style scoped>
.items-section { margin-top: 10px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; margin: 0; }
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
