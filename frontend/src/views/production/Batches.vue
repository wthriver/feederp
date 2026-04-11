<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.batches') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Batch</button>
        </div>

        <div class="toolbar">
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
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
                        <th>Batch #</th>
                        <th>Date</th>
                        <th>Formula</th>
                        <th>Product</th>
                        <th>Planned Qty</th>
                        <th>Actual Qty</th>
                        <th>Loss %</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.batch_number }}</td>
                        <td>{{ item.batch_date }}</td>
                        <td>{{ item.formula_name }}</td>
                        <td>{{ item.product_name }}</td>
                        <td class="font-mono">{{ item.planned_qty }} kg</td>
                        <td class="font-mono">{{ item.actual_qty || '-' }}</td>
                        <td class="font-mono">{{ item.loss_percentage ? item.loss_percentage.toFixed(2) + '%' : '-' }}</td>
                        <td><span :class="['badge', statusClass(item.status)]">{{ item.status }}</span></td>
                        <td>
                            <button v-if="item.status === 'planned'" class="btn btn-sm btn-icon" @click="startBatch(item)">▶️</button>
                            <button v-if="item.status === 'in_progress'" class="btn btn-sm btn-icon" @click="completeBatch(item)">✅</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">New Production Batch</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Formula *</label>
                        <select v-model="form.formula_id" class="select-field" @change="onFormulaChange">
                            <option value="">Select Formula</option>
                            <option v-for="f in formulas" :key="f.id" :value="f.id">{{ f.name }}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Product *</label>
                        <select v-model="form.product_id" class="select-field">
                            <option value="">Select Product</option>
                            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </select>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Planned Qty (kg) *</label>
                            <input v-model.number="form.planned_qty" type="number" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Batch Date *</label>
                            <input v-model="form.batch_date" type="date" class="input-field" required />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Godown *</label>
                            <select v-model="form.godown_id" class="select-field">
                                <option value="">Select Godown</option>
                                <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Shift</label>
                            <select v-model="form.shift" class="select-field">
                                <option value="morning">Morning</option>
                                <option value="evening">Evening</option>
                                <option value="night">Night</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
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
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const formulas = ref([])
const products = ref([])
const godowns = ref([])
const showModal = ref(false)
const filter = reactive({ status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    formula_id: '', product_id: '', planned_qty: 0, batch_date: new Date().toISOString().slice(0, 10),
    godown_id: '', shift: 'morning', notes: '', machine_id: ''
})
const errors = reactive({})
const touched = reactive({})

function validateField(field) {
    if (field === 'formula_id') errors.formula_id = !form.formula_id ? 'Please select a formula' : ''
    if (field === 'product_id') errors.product_id = !form.product_id ? 'Please select a product' : ''
    if (field === 'planned_qty') errors.planned_qty = !form.planned_qty || form.planned_qty <= 0 ? 'Please enter planned quantity' : ''
    if (field === 'batch_date') errors.batch_date = !form.batch_date ? 'Please select a date' : ''
    if (field === 'godown_id') errors.godown_id = !form.godown_id ? 'Please select a godown' : ''
}

function validateAll() {
    errors.formula_id = !form.formula_id ? 'Please select a formula' : ''
    errors.product_id = !form.product_id ? 'Please select a product' : ''
    errors.planned_qty = !form.planned_qty || form.planned_qty <= 0 ? 'Please enter planned quantity' : ''
    errors.batch_date = !form.batch_date ? 'Please select a date' : ''
    errors.godown_id = !form.godown_id ? 'Please select a godown' : ''
    return !errors.formula_id && !errors.product_id && !errors.planned_qty && !errors.batch_date && !errors.godown_id
}

function statusClass(status) {
    const classes = { planned: 'badge-secondary', in_progress: 'badge-warning', completed: 'badge-success', cancelled: 'badge-danger' }
    return classes[status] || 'badge-secondary'
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/production/batches', { params: filter })
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadFormulas() {
    try {
        const response = await api.get('/production/formulas', { params: { status: 'approved' } })
        if (response.data.success) formulas.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadProducts() {
    try {
        const response = await api.get('/master/products')
        if (response.data.success) products.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadGodowns() {
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) godowns.value = response.data.data
    } catch (error) { console.error(error) }
}

function onFormulaChange() {
    const formula = formulas.value.find(f => f.id === form.formula_id)
    if (formula) form.product_id = formula.product_id
}

function openModal() { showModal.value = true }

async function startBatch(item) {
    try {
        await api.post(`/production/batches/${item.id}/start`)
        window.showToast?.({ type: 'success', message: 'Batch started' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function completeBatch(item) {
    const actual_qty = prompt('Enter actual quantity (kg):', item.planned_qty)
    if (actual_qty === null) return
    try {
        await api.post(`/production/batches/${item.id}/complete`, { actual_qty: parseFloat(actual_qty), loss_percentage: ((item.planned_qty - actual_qty) / item.planned_qty) * 100 })
        window.showToast?.({ type: 'success', message: 'Batch completed' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    Object.keys(errors).forEach(k => touched[k] = true)
    if (!validateAll()) return
    
    try {
        await api.post('/production/batches', form)
        window.showToast?.({ type: 'success', message: 'Batch created' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed: ' + (error.response?.data?.error?.message || error.message) }) }
}

onMounted(() => { loadData(); loadFormulas(); loadProducts(); loadGodowns() })
</script>
