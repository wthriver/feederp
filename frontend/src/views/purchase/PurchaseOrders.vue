<template>
    <div class="data-page">
        <div class="page-header">
            <div class="page-header-left">
                <h1>{{ $t('nav.purchaseOrders') }}</h1>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" @click="showModal = true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New PO
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
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="partial">Partial</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            <div class="divider-v"></div>

            <div class="filter-group">
                <input v-model="filter.from_date" type="date" class="toolbar-input" @change="loadData" placeholder="From" />
                <span class="date-sep">-</span>
                <input v-model="filter.to_date" type="date" class="toolbar-input" @change="loadData" placeholder="To" />
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
                        <th>PO Number</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Expected</th>
                        <th class="num">Amount</th>
                        <th>Status</th>
                        <th style="width: 100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="po in data" :key="po.id" @click="view(po)" style="cursor: pointer;">
                        <td class="mono">{{ po.po_number }}</td>
                        <td>{{ formatDate(po.po_date) }}</td>
                        <td>{{ po.supplier_name }}</td>
                        <td>{{ po.expected_date ? formatDate(po.expected_date) : '-' }}</td>
                        <td class="num">৳{{ formatNumber(po.total_amount) }}</td>
                        <td><span :class="['badge', statusClass(po.status)]">{{ po.status }}</span></td>
                        <td>
                            <div class="action-cell">
                                <button class="action-btn" @click.stop="edit(po)" v-if="po.status === 'draft'" title="Edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="action-btn" @click.stop="approve(po)" v-if="po.status === 'draft'" title="Approve">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                                <button class="action-btn" @click.stop="printPo(po)" title="Print">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                        <rect x="6" y="14" width="12" height="8"></rect>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="7" class="text-center text-muted" style="padding: 40px;">
                            No purchase orders found
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Showing {{ data.length }} of {{ meta.total }} records</div>
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

        <AppModal v-model="showModal" :title="editing ? 'Edit Purchase Order' : 'New Purchase Order'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">PO Number</label>
                    <input type="text" class="input-field" :value="form.po_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group" :class="{ 'has-error': errors.supplier_id }">
                    <label class="form-label">Supplier *</label>
                    <select v-model="form.supplier_id" class="select-field" :class="{ 'is-invalid': errors.supplier_id }" @change="onSupplierChange">
                        <option value="">Select</option>
                        <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">PO Date</label>
                    <input v-model="form.po_date" type="date" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Expected Date</label>
                    <input v-model="form.expected_date" type="date" class="input-field" />
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Godown</label>
                    <select v-model="form.godown_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
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
                        <option value="cod">COD</option>
                    </select>
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
                    <label class="form-label">Reference</label>
                    <input v-model="form.reference_number" type="text" class="input-field" placeholder="Ref #" />
                </div>
            </div>

            <div v-if="selectedSupplier" class="info-grid" style="margin-top: 6px;">
                <div class="info-item">
                    <span class="info-label">Contact</span>
                    <span class="info-value">{{ selectedSupplier.contact_person || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone</span>
                    <span class="info-value">{{ selectedSupplier.phone || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Credit Limit</span>
                    <span class="info-value">৳{{ formatNumber(selectedSupplier.credit_limit) }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Balance</span>
                    <span class="info-value">৳{{ formatNumber(selectedSupplier.credit_balance) }}</span>
                </div>
            </div>

            <div class="items-section" style="margin-top: 6px;">
                <div class="section-header">
                    <h4>Items</h4>
                    <button type="button" class="btn btn-sm" @click="addItem">+ Add</button>
                </div>
                <div v-if="errors.items" class="error-message" style="padding: 6px 8px;">{{ errors.items }}</div>
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th style="width: 30px;">#</th>
                            <th>Material</th>
                            <th style="width: 70px;">Qty</th>
                            <th style="width: 60px;">Unit</th>
                            <th style="width: 90px;">Rate</th>
                            <th style="width: 70px;">Disc%</th>
                            <th style="width: 100px;">Amount</th>
                            <th style="width: 36px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in form.items" :key="idx">
                            <td class="text-center">{{ idx + 1 }}</td>
                            <td>
                                <select v-model="item.raw_material_id" class="table-select" @change="selectMaterial(item)">
                                    <option value="">Select</option>
                                    <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                                </select>
                            </td>
                            <td><input v-model.number="item.quantity" type="number" class="table-input" min="0" @input="calcItemAmount(item)" /></td>
                            <td>
                                <select v-model="item.unit_id" class="table-select" @change="updateUnitName(item)">
                                    <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                                </select>
                            </td>
                            <td><input v-model.number="item.rate" type="number" class="table-input text-right" min="0" @input="calcItemAmount(item)" /></td>
                            <td><input v-model.number="item.discount_percent" type="number" class="table-input text-right" min="0" max="100" @input="calcItemAmount(item)" /></td>
                            <td class="num">৳{{ formatNumber(item.amount) }}</td>
                            <td>
                                <button type="button" class="action-btn danger" @click="removeItem(idx)" title="Remove">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" class="text-right"><strong>Sub Total:</strong></td>
                            <td class="num"><strong>৳{{ formatNumber(totalAmount) }}</strong></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="text-right">Discount:</td>
                            <td class="num">(-) ৳{{ formatNumber(form.discount_amount || 0) }}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="text-right">Tax:</td>
                            <td class="num">(+) ৳{{ formatNumber(form.tax_amount || 0) }}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="text-right"><strong>Grand Total:</strong></td>
                            <td class="num"><strong>৳{{ formatNumber(grandTotal) }}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="form-row form-row-2" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Terms</label>
                    <textarea v-model="form.terms" class="input-field" rows="2" placeholder="Terms & Conditions"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea v-model="form.notes" class="input-field" rows="2" placeholder="Internal notes"></textarea>
                </div>
            </div>

            <div class="form-row form-row-2" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Terms</label>
                    <textarea v-model="form.terms" class="input-field" rows="2" placeholder="Terms & Conditions"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea v-model="form.notes" class="input-field" rows="2" placeholder="Internal notes"></textarea>
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal" :disabled="saving">Cancel</button>
                <button class="btn btn-primary" :class="{ loading: saving }" @click="save" :disabled="saving">
                    {{ saving ? 'Saving...' : 'Save' }}
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
const suppliers = ref([])
const materials = ref([])
const units = ref([])
const godowns = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })
const errors = reactive({})
const touched = reactive({})

const form = reactive({
    supplier_id: '',
    po_number: '',
    po_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    godown_id: '',
    priority: 'normal',
    reference_number: '',
    payment_terms: '',
    items: [],
    terms: '',
    notes: '',
    discount_amount: 0,
    tax_amount: 0,
    shipping_cost: 0,
    status: 'draft'
})

const selectedSupplier = computed(() => suppliers.value.find(s => s.id === form.supplier_id))

const totalAmount = computed(() => {
    return form.items.reduce((sum, item) => sum + (item.amount || 0), 0)
})

const grandTotal = computed(() => {
    return totalAmount.value - (form.discount_amount || 0) + (form.tax_amount || 0) + (form.shipping_cost || 0)
})

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

function statusClass(status) {
    const classes = { draft: 'badge-secondary', sent: 'badge-info', partial: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger' }
    return classes[status] || 'badge-secondary'
}

function touchField(field) {
    touched[field] = true
    validateField(field)
}

function validateField(field) {
    if (field === 'supplier_id') {
        errors.supplier_id = !form.supplier_id ? 'Please select a supplier' : ''
    }
    if (field === 'items') {
        if (form.items.length === 0) {
            errors.items = 'Please add at least one item'
        } else {
            const hasValidItems = form.items.some(item => item.raw_material_id && item.quantity > 0)
            errors.items = hasValidItems ? '' : 'Please fill in all item details'
        }
    }
}

function validateAll() {
    errors.supplier_id = !form.supplier_id ? 'Please select a supplier' : ''
    if (form.items.length === 0) {
        errors.items = 'Please add at least one item'
    } else {
        const hasValidItems = form.items.some(item => item.raw_material_id && item.quantity > 0)
        errors.items = hasValidItems ? '' : 'Please fill in all item details'
    }
    return !errors.supplier_id && !errors.items
}

function debounceLoad() {
    setTimeout(loadData, 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/purchase/purchase-orders', { params: { ...filter, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function loadSuppliers() {
    try {
        const response = await api.get('/master/suppliers')
        if (response.data.success) suppliers.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadMaterials() {
    try {
        const response = await api.get('/master/raw-materials')
        if (response.data.success) materials.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadUnits() {
    try {
        const response = await api.get('/master/units')
        if (response.data.success) units.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadGodowns() {
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) godowns.value = response.data.data
    } catch (error) { console.error(error) }
}

function onSupplierChange() {
    if (selectedSupplier.value && selectedSupplier.value.default_payment_terms) {
        form.payment_terms = selectedSupplier.value.default_payment_terms
    }
}

function addItem() {
    form.items.push({
        raw_material_id: '',
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

function selectMaterial(item) {
    const m = materials.value.find(mat => mat.id === item.raw_material_id)
    if (m) {
        item.unit_id = m.unit_id
        item.unit_name = m.unit_name || m.unit_code
        item.rate = m.opening_rate || 0
        item.tax_percent = m.tax_rate || 0
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
    const subtotal = totalAmount.value
    const discount = form.discount_amount || 0
    const shipping = form.shipping_cost || 0
    
    form.tax_amount = subtotal - discount
}

function openModal() {
    editing.value = null
    form.supplier_id = ''
    form.po_number = ''
    form.po_date = new Date().toISOString().slice(0, 10)
    form.expected_date = ''
    form.godown_id = ''
    form.priority = 'normal'
    form.reference_number = ''
    form.payment_terms = ''
    form.items = []
    form.terms = ''
    form.notes = ''
    form.discount_amount = 0
    form.tax_amount = 0
    form.shipping_cost = 0
    form.status = 'draft'
    Object.assign(errors, {})
    Object.assign(touched, {})
    showModal.value = true
}

async function view(po) {
    try {
        const response = await api.get(`/purchase/purchase-orders/${po.id}`)
        if (response.data.success) {
            const order = response.data.data
            editing.value = order
            form.supplier_id = order.supplier_id
            form.po_number = order.po_number
            form.po_date = order.po_date
            form.expected_date = order.expected_date || ''
            form.godown_id = order.godown_id || ''
            form.priority = order.priority || 'normal'
            form.reference_number = order.reference_number || ''
            form.payment_terms = order.payment_terms || ''
            form.notes = order.notes || ''
            form.terms = order.terms || ''
            form.discount_amount = order.discount_amount || 0
            form.tax_amount = order.tax_amount || 0
            form.shipping_cost = order.shipping_cost || 0
            form.status = order.status || 'draft'
            form.items = order.items?.map(item => ({
                raw_material_id: item.raw_material_id,
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

function edit(po) {
    view(po)
}

async function approve(po) {
    try {
        await api.post(`/purchase/purchase-orders/${po.id}/approve`)
        window.showToast?.({ type: 'success', message: 'PO approved' })
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Approval failed' })
    }
}

async function saveDraft() {
    form.status = 'draft'
    await save()
}

async function save() {
    touched.supplier_id = true
    touched.items = true
    validateAll()
    
    if (!form.supplier_id || form.items.length === 0) {
        return
    }
    
    const hasValidItems = form.items.some(item => item.raw_material_id && item.quantity > 0)
    if (!hasValidItems) {
        return
    }
    
    saving.value = true
    try {
        const payload = {
            ...form,
            status: form.status || 'draft'
        }
        if (editing.value) {
            await api.put(`/purchase/purchase-orders/${editing.value.id}`, payload)
        } else {
            await api.post('/purchase/purchase-orders', payload)
        }
        window.showToast?.({ type: 'success', message: 'PO saved successfully' })
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

onMounted(() => {
    loadData()
    loadSuppliers()
    loadMaterials()
    loadUnits()
    loadGodowns()
})
</script>

<style scoped>
.items-section {
    margin-top: 16px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.section-header h4 {
    font-size: var(--font-size-base);
    font-weight: 600;
}

.items-section table {
    margin-top: 8px;
}

.items-section table th,
.items-section table td {
    padding: 6px;
}

.items-section table .input-field,
.items-section table .select-field {
    width: 100%;
    padding: 4px 8px;
    font-size: var(--font-size-sm);
}

.form-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-light);
}

.form-section:last-child {
    border-bottom: none;
}

.section-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-primary);
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    background: var(--bg-secondary);
    padding: 12px;
    border-radius: 4px;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.info-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-weight: 500;
}

.info-value {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: 500;
}

.text-right {
    text-align: right;
}

.text-center {
    text-align: center;
}
</style>
