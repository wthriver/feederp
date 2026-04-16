<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.goodsInward') }}</h1>
            <button class="btn btn-primary" @click="showModal = true">+ New Entry</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
            </select>
            <input v-model="filter.from_date" type="date" class="input-field" @change="loadData" />
            <input v-model="filter.to_date" type="date" class="input-field" @change="loadData" />
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>GRN Number</th>
                        <th>Date</th>
                        <th>PO Reference</th>
                        <th>Supplier</th>
                        <th>Challan No</th>
                        <th>Godown</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="grn in data" :key="grn.id">
                        <td class="font-mono">{{ grn.grn_number }}</td>
                        <td>{{ grn.grn_date }}</td>
                        <td class="font-mono">{{ grn.po_number || '-' }}</td>
                        <td>{{ grn.supplier_name }}</td>
                        <td>{{ grn.challan_no || '-' }}</td>
                        <td>{{ grn.godown_name }}</td>
                        <td class="text-center">{{ grn.item_count }}</td>
                        <td><span :class="['badge', statusClass(grn.status)]">{{ grn.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(grn)">👁️</button>
                            <button class="btn btn-sm btn-icon" @click="print(grn)">🖨️</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="9" class="text-center text-muted">No records found</td>
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

        <AppModal v-model="showModal" :title="editing ? 'Edit Goods Inward' : 'New Goods Inward'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">PO Reference</label>
                    <select v-model="form.po_id" class="select-field" @change="onPoChange">
                        <option value="">Select (Optional)</option>
                        <option v-for="po in pendingPOs" :key="po.id" :value="po.id">{{ po.po_number }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Supplier *</label>
                    <select v-model="form.supplier_id" class="select-field" required @change="loadPoItems">
                        <option value="">Select</option>
                        <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Inward Date *</label>
                    <input v-model="form.inward_date" type="date" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Challan No</label>
                    <input v-model="form.challan_number" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Godown *</label>
                    <select v-model="form.godown_id" class="select-field" required>
                        <option value="">Select</option>
                        <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Vehicle No</label>
                    <input v-model="form.vehicle_number" type="text" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Quality Check</label>
                    <select v-model="form.qc_required" class="select-field">
                        <option :value="true">Required</option>
                        <option :value="false">Not Required</option>
                    </select>
                </div>
                <div class="form-group span-4">
                    <label class="form-label">Notes</label>
                    <input v-model="form.notes" type="text" class="input-field" />
                </div>
            </div>

            <div class="items-section">
                <div class="section-header">
                    <h4>Items</h4>
                    <button type="button" class="btn btn-sm" @click="addItem">+ Add</button>
                </div>
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th>Material</th>
                            <th style="width: 80px;">PO Qty</th>
                            <th style="width: 100px;">Received</th>
                            <th style="width: 60px;">Unit</th>
                            <th style="width: 100px;">Rate</th>
                            <th style="width: 120px;">Amount</th>
                            <th style="width: 100px;">Batch</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in form.items" :key="idx">
                            <td>
                                <select v-model="item.raw_material_id" class="table-select" @change="selectMaterial(item)">
                                    <option value="">Select</option>
                                    <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
                                </select>
                            </td>
                            <td class="font-mono text-right">{{ item.po_quantity || '-' }}</td>
                            <td>
                                <input v-model.number="item.quantity" type="number" class="table-input text-right" min="0" @input="calcAmount(item)" />
                            </td>
                            <td class="text-center">{{ item.unit_name || '-' }}</td>
                            <td>
                                <input v-model.number="item.rate" type="number" class="table-input text-right" step="0.01" @input="calcAmount(item)" />
                            </td>
                            <td class="font-mono text-right">৳{{ ((item.quantity || 0) * (item.rate || 0)).toLocaleString() }}</td>
                            <td>
                                <input v-model="item.batch_number" type="text" class="table-input" placeholder="Batch" />
                            </td>
                            <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-right"><strong>Total:</strong></td>
                            <td class="font-mono text-right"><strong>৳{{ totalAmount.toLocaleString() }}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal">Cancel</button>
                <button class="btn btn-primary" @click="save">Save</button>
            </template>
        </AppModal>

        <AppModal v-model="viewModal" :title="'GRN Details - ' + selectedItem?.grn_number" size="lg" :loading="false">
            <div class="detail-grid">
                <div class="detail-item">
                    <label>GRN Number</label>
                    <span class="font-mono">{{ selectedItem?.grn_number }}</span>
                </div>
                <div class="detail-item">
                    <label>Date</label>
                    <span>{{ selectedItem?.grn_date }}</span>
                </div>
                <div class="detail-item">
                    <label>PO Reference</label>
                    <span class="font-mono">{{ selectedItem?.po_number || 'N/A' }}</span>
                </div>
                <div class="detail-item">
                    <label>Supplier</label>
                    <span>{{ selectedItem?.supplier_name }}</span>
                </div>
                <div class="detail-item">
                    <label>Challan No</label>
                    <span>{{ selectedItem?.challan_no || 'N/A' }}</span>
                </div>
                <div class="detail-item">
                    <label>Godown</label>
                    <span>{{ selectedItem?.godown_name }}</span>
                </div>
                <div class="detail-item">
                    <label>Vehicle No</label>
                    <span>{{ selectedItem?.vehicle_no || 'N/A' }}</span>
                </div>
                <div class="detail-item">
                    <label>Status</label>
                    <span :class="['badge', statusClass(selectedItem?.status)]">{{ selectedItem?.status }}</span>
                </div>
            </div>

            <h4 style="margin-top: 12px;">Items</h4>
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>Received Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Batch No</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, idx) in selectedItem?.items" :key="idx">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ item.material_name }}</td>
                        <td class="font-mono text-right">{{ item.quantity }}</td>
                        <td>{{ item.unit_name }}</td>
                        <td class="font-mono text-right">৳{{ item.rate }}</td>
                        <td class="font-mono text-right">৳{{ (item.quantity * item.rate).toLocaleString() }}</td>
                        <td>{{ item.batch_number || '-' }}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" class="text-right"><strong>Total:</strong></td>
                        <td class="font-mono"><strong>৳{{ selectedItem?.total_amount?.toLocaleString() }}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            <template #footer>
                <button class="btn" @click="viewModal = false">Close</button>
                <button class="btn btn-primary" @click="print(selectedItem)">Print</button>
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
const godowns = ref([])
const pendingPOs = ref([])
const showModal = ref(false)
const viewModal = ref(false)
const editing = ref(null)
const selectedItem = ref(null)
const filter = reactive({ search: '', status: '', from_date: '', to_date: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })

const form = reactive({
    po_id: '', inward_date: new Date().toISOString().slice(0, 10), supplier_id: '',
    godown_id: '', challan_number: '', vehicle_number: '', qc_required: false,
    items: [], notes: ''
})

const totalAmount = computed(() => form.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0))

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

function statusClass(status) {
    const classes = { pending: 'badge-warning', partial: 'badge-info', completed: 'badge-success' }
    return classes[status] || 'badge-secondary'
}

function debounceLoad() {
    setTimeout(loadData, 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/purchase/goods-inward', { params: { ...filter, page: meta.page } })
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

async function loadGodowns() {
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) godowns.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadPendingPOs() {
    try {
        const response = await api.get('/purchase/purchase-orders', { params: { status: 'sent,partial' } })
        if (response.data.success) pendingPOs.value = response.data.data
    } catch (error) { console.error(error) }
}

function onPoChange() {
    if (form.po_id) {
        const po = pendingPOs.value.find(p => p.id === form.po_id)
        if (po) {
            form.supplier_id = po.supplier_id
            loadPoItems()
        }
    }
}

async function loadPoItems() {
    if (form.po_id) {
        try {
            const response = await api.get(`/purchase/purchase-orders/${form.po_id}`)
            if (response.data.success && response.data.data) {
                const poData = response.data.data
                form.items = (poData.items || []).map(item => ({
                    raw_material_id: item.raw_material_id,
                    po_item_id: item.id,
                    material_name: item.material_name,
                    po_quantity: item.quantity,
                    quantity: item.quantity - (item.delivered_qty || 0),
                    unit_id: item.unit_id,
                    unit_name: item.unit_name,
                    rate: item.rate,
                    batch_number: '',
                    accepted_qty: item.quantity - (item.delivered_qty || 0),
                    rejected_qty: 0
                }))
            }
        } catch (error) { console.error(error) }
    }
}

function addItem() {
    form.items.push({ raw_material_id: '', po_quantity: '', quantity: 0, unit_id: '', unit_name: '', rate: 0, batch_number: '' })
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

async function view(grn) {
    try {
        const response = await api.get(`/purchase/goods-inward/${grn.id}`)
        if (response.data.success) {
            selectedItem.value = response.data.data
            viewModal.value = true
        }
    } catch (error) { console.error(error) }
}

function print(grn) {
    window.print()
}

async function save() {
    saving.value = true
    try {
        if (!form.supplier_id || !form.godown_id || !form.inward_date) {
            window.showToast?.({ type: 'error', message: 'Please fill required fields' })
            return
        }
        if (form.items.length === 0) {
            window.showToast?.({ type: 'error', message: 'Please add at least one item' })
            return
        }

        if (editing.value) {
            await api.put(`/purchase/goods-inward/${editing.value.id}`, form)
        } else {
            await api.post('/purchase/goods-inward', form)
        }
        window.showToast?.({ type: 'success', message: 'Goods Inward saved successfully' })
        closeModal()
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: error.response?.data?.message || 'Save failed' })
    } finally {
        saving.value = false
    }
}

function closeModal() {
    showModal.value = false
    editing.value = null
    Object.assign(form, {
        po_id: '', inward_date: new Date().toISOString().slice(0, 10), supplier_id: '',
        godown_id: '', challan_number: '', vehicle_number: '', qc_required: false,
        items: [], notes: ''
    })
}

onMounted(() => {
    loadData()
    loadSuppliers()
    loadMaterials()
    loadGodowns()
    loadPendingPOs()
})
</script>

<style scoped>
.items-section { margin-top: 12px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; margin: 0; }
.detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; }
.detail-item span { font-size: var(--font-size-sm); font-weight: 500; }
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
