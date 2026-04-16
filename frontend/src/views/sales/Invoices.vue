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
                        <td class="font-mono">৳{{ item.net_amount?.toLocaleString() }}</td>
                        <td class="font-mono text-success">৳{{ item.amount_paid?.toLocaleString() }}</td>
                        <td class="font-mono text-danger">৳{{ item.amount_due?.toLocaleString() }}</td>
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

        <AppModal v-model="showModal" :title="editing ? 'Edit Invoice' : 'New Invoice'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Invoice #</label>
                    <input type="text" class="input-field" :value="form.invoice_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group span-2" :class="{ 'has-error': errors.customer_id }">
                    <label class="form-label">Customer *</label>
                    <select v-model="form.customer_id" class="select-field" @change="onCustomerChange">
                        <option value="">Select</option>
                        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Sales Order</label>
                    <select v-model="form.order_id" class="select-field" @change="onOrderChange">
                        <option value="">Select (Optional)</option>
                        <option v-for="o in orders" :key="o.id" :value="o.id">{{ o.order_number }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Reference</label>
                    <input v-model="form.reference_number" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Transportation</label>
                    <input v-model="form.transport_details" type="text" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Invoice Date *</label>
                    <input v-model="form.invoice_date" type="date" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input v-model="form.due_date" type="date" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Terms</label>
                    <select v-model="form.payment_terms" class="select-field">
                        <option value="">Select</option>
                        <option value="immediate">Immediate</option>
                        <option value="net15">Net 15</option>
                        <option value="net30">Net 30</option>
                        <option value="net45">Net 45</option>
                    </select>
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
                    <span class="info-label">GST</span>
                    <span class="info-value">{{ selectedCustomer.gst_number || '-' }}</span>
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
                            <th style="width: 40px;">#</th>
                            <th>Product</th>
                            <th style="width: 70px;">Qty</th>
                            <th style="width: 70px;">Unit</th>
                            <th style="width: 100px;">Rate</th>
                            <th style="width: 70px;">Disc %</th>
                            <th style="width: 70px;">Tax %</th>
                            <th style="width: 120px;">Amount</th>
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
                                <select v-model="item.unit_id" class="table-select">
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
                            <td class="font-mono text-right"><strong>৳{{ subTotal.toLocaleString() }}</strong></td>
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
                            <td colspan="7" class="text-right"><strong>Grand Total:</strong></td>
                            <td class="font-mono text-right"><strong>৳{{ grandTotal.toLocaleString() }}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group span-3">
                    <label class="form-label">Terms & Conditions</label>
                    <textarea v-model="form.terms" class="input-field" rows="2" placeholder="Enter terms"></textarea>
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Notes</label>
                    <textarea v-model="form.notes" class="input-field" rows="2" placeholder="Internal notes"></textarea>
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="save">{{ $t('common.save') }}</button>
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
const orders = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    customer_id: '',
    order_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    payment_terms: '',
    reference_number: '',
    transport_details: '',
    items: [],
    terms: '',
    notes: '',
    discount_amount: 0,
    tax_amount: 0,
    shipping_cost: 0
})

const errors = reactive({})
const touched = reactive({})

const selectedCustomer = computed(() => customers.value.find(c => c.id === form.customer_id))
const subTotal = computed(() => form.items.reduce((sum, item) => sum + (item.amount || 0), 0))
const grandTotal = computed(() => subTotal.value - (form.discount_amount || 0) + (form.tax_amount || 0) + (form.shipping_cost || 0))

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

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

async function loadUnits() {
    try {
        const response = await api.get('/master/units')
        if (response.data.success) units.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadOrders() {
    try {
        const response = await api.get('/sales/orders', { params: { status: 'confirmed' } })
        if (response.data.success) orders.value = response.data.data
    } catch (error) { console.error(error) }
}

function onCustomerChange() {
    if (selectedCustomer.value && selectedCustomer.value.default_payment_terms) {
        form.payment_terms = selectedCustomer.value.default_payment_terms
    }
}

function onOrderChange() {
    const order = orders.value.find(o => o.id === form.order_id)
    if (order) {
        form.items = order.items?.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_id: item.unit_id,
            unit_name: item.unit_name,
            rate: item.rate,
            discount_percent: item.discount_percent || 0,
            tax_percent: item.tax_percent || 0,
            amount: item.amount || 0
        })) || []
        form.customer_id = order.customer_id
    }
}

function openModal() {
    editing.value = null
    form.customer_id = ''
    form.order_id = ''
    form.invoice_number = ''
    form.invoice_date = new Date().toISOString().slice(0, 10)
    form.due_date = ''
    form.payment_terms = ''
    form.reference_number = ''
    form.transport_details = ''
    form.items = []
    form.terms = ''
    form.notes = ''
    form.discount_amount = 0
    form.tax_amount = 0
    form.shipping_cost = 0
    showModal.value = true
}

function addItem() {
    form.items.push({
        product_id: '',
        quantity: 0,
        unit_id: '',
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
    const p = products.value.find(prod => prod.id === item.product_id)
    if (p) {
        item.unit_id = p.unit_id
        item.rate = p.mrp || 0
        item.tax_percent = p.tax_rate || 0
        calcItemAmount(item)
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
    const totalTax = (form.items || []).reduce((sum, item) => {
        const qty = item.quantity || 0
        const rate = item.rate || 0
        const taxPct = item.tax_percent || 0
        const subtotal = qty * rate
        const afterDiscount = subtotal - ((subtotal * (item.discount_percent || 0)) / 100)
        return sum + (afterDiscount * taxPct / 100)
    }, 0)
    form.tax_amount = totalTax
}

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
    
    saving.value = true
    try {
        await api.post('/sales/invoices', form)
        window.showToast?.({ type: 'success', message: 'Invoice created' })
        showModal.value = false
        loadData()
    } catch (error) { 
        window.showToast?.({ type: 'error', message: 'Save failed: ' + (error.response?.data?.error?.message || error.message) }) 
    } finally {
        saving.value = false
    }
}

onMounted(() => { loadData(); loadCustomers(); loadProducts(); loadUnits(); loadOrders() })
</script>

<style scoped>
.items-section { margin-top: 12px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; margin: 0; }
.info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: var(--bg-secondary); padding: 10px; border-radius: 4px; margin-top: 12px; }
.info-item { display: flex; flex-direction: column; gap: 2px; }
.info-label { font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 500; }
.info-value { font-size: var(--font-size-sm); color: var(--text-primary); font-weight: 500; }
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
