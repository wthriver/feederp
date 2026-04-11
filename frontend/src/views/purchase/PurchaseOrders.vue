<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.purchaseOrders') }}</h1>
            <button class="btn btn-primary" @click="showModal = true">+ New PO</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="received">Received</option>
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
                        <th>PO Number</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Expected Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="po in data" :key="po.id">
                        <td class="font-mono">{{ po.po_number }}</td>
                        <td>{{ po.po_date }}</td>
                        <td>{{ po.supplier_name }}</td>
                        <td>{{ po.expected_date || '-' }}</td>
                        <td class="font-mono text-right">₹{{ formatNumber(po.total_amount) }}</td>
                        <td><span :class="['badge', statusClass(po.status)]">{{ po.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(po)">👁️</button>
                            <button v-if="po.status === 'draft'" class="btn btn-sm btn-icon" @click="edit(po)">✏️</button>
                            <button v-if="po.status === 'draft'" class="btn btn-sm btn-icon" @click="approve(po)">✅</button>
                        </td>
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
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'New' }} Purchase Order</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-3">
                        <div class="form-group" :class="{ 'has-error': errors.supplier_id }">
                            <label class="form-label">Supplier *</label>
                            <select v-model="form.supplier_id" class="select-field" :class="{ 'is-invalid': errors.supplier_id }" @blur="touchField('supplier_id')">
                                <option value="">Select Supplier</option>
                                <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                            </select>
                            <span v-if="errors.supplier_id" class="error-message">{{ errors.supplier_id }}</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">PO Date *</label>
                            <input v-model="form.po_date" type="date" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Expected Date</label>
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
                                    <th>Material</th>
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
                                        <select v-model="item.raw_material_id" class="select-field" @change="selectMaterial(item)">
                                            <option value="">Select</option>
                                            <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                                        </select>
                                    </td>
                                    <td><input v-model.number="item.quantity" type="number" class="input-field" @input="calcAmount(item)" /></td>
                                    <td>{{ item.unit_name }}</td>
                                    <td><input v-model.number="item.rate" type="number" class="input-field" @input="calcAmount(item)" /></td>
                                    <td class="font-mono">₹{{ (item.quantity * item.rate).toLocaleString() }}</td>
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
const suppliers = ref([])
const materials = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })
const errors = reactive({})
const touched = reactive({})

const form = reactive({
    supplier_id: '', po_date: new Date().toISOString().slice(0, 10), expected_date: '', items: [], notes: ''
})

const totalAmount = computed(() => form.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0))

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

function addItem() {
    form.items.push({ raw_material_id: '', description: '', quantity: 0, unit_id: '', unit_name: '', rate: 0 })
}

function removeItem(idx) {
    form.items.splice(idx, 1)
}

function selectMaterial(item) {
    const m = materials.value.find(mat => mat.id === item.raw_material_id)
    if (m) {
        item.unit_id = m.unit_id
        item.unit_name = m.unit_name
        item.rate = m.opening_rate || 0
    }
}

function calcAmount(item) {
    // Auto-calculate
}

function openModal() {
    editing.value = null
    form.supplier_id = ''
    form.po_date = new Date().toISOString().slice(0, 10)
    form.expected_date = ''
    form.items = []
    form.notes = ''
    Object.assign(errors, {})
    Object.assign(touched, {})
    showModal.value = true
}

async function view(po) {
    try {
        const response = await api.get(`/purchase/purchase-orders/${po.id}`)
        if (response.data.success) {
            console.log(response.data.data)
        }
    } catch (error) { console.error(error) }
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
        if (editing.value) {
            await api.put(`/purchase/purchase-orders/${editing.value.id}`, form)
        } else {
            await api.post('/purchase/purchase-orders', form)
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
</style>
