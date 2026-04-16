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

        <AppModal v-model="showModal" :title="editing ? 'Edit Batch' : 'New Batch'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Batch #</label>
                    <input type="text" class="input-field" :value="form.batch_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group" :class="{ 'has-error': errors.formula_id }">
                    <label class="form-label">Formula *</label>
                    <select v-model="form.formula_id" class="select-field" @change="onFormulaChange">
                        <option value="">Select</option>
                        <option v-for="f in formulas" :key="f.id" :value="f.id">{{ f.name }}</option>
                    </select>
                </div>
                <div class="form-group" :class="{ 'has-error': errors.product_id }">
                    <label class="form-label">Product *</label>
                    <select v-model="form.product_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
                <div class="form-group" :class="{ 'has-error': errors.batch_date }">
                    <label class="form-label">Date *</label>
                    <input v-model="form.batch_date" type="date" class="input-field" required />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group" :class="{ 'has-error': errors.planned_qty }">
                    <label class="form-label">Qty (kg) *</label>
                    <input v-model.number="form.planned_qty" type="number" class="input-field" required />
                </div>
                <div class="form-group" :class="{ 'has-error': errors.godown_id }">
                    <label class="form-label">Godown *</label>
                    <select v-model="form.godown_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Machine</label>
                    <select v-model="form.machine_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="m in machines" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Shift</label>
                    <select v-model="form.shift" class="select-field">
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                        <option value="night">Night</option>
                    </select>
                </div>
            </div>

            <div v-if="selectedFormula" class="info-grid">
                <div class="info-item">
                    <span class="info-label">Formula</span>
                    <span class="info-value">{{ selectedFormula.name }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Cost/1000kg</span>
                    <span class="info-value">৳{{ formatNumber(selectedFormula.cost_per_1000kg) }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Protein</span>
                    <span class="info-value">{{ selectedFormula.target_protein }}%</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Moisture</span>
                    <span class="info-value">{{ selectedFormula.target_moisture }}%</span>
                </div>
            </div>

            <div class="items-section">
                <div class="section-header">
                    <h4>Materials</h4>
                </div>
                <div v-if="form.items && form.items.length > 0">
                    <table class="sheet-grid">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th style="width: 100px;">Required</th>
                                <th style="width: 100px;">Consumed</th>
                                <th style="width: 60px;">Unit</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(item, idx) in form.items" :key="idx">
                                <td>{{ item.material_name }}</td>
                                <td class="font-mono text-right">{{ item.required_qty?.toFixed(2) }}</td>
                                <td><input v-model.number="item.consumed_qty" type="number" class="table-input text-right" /></td>
                                <td>{{ item.unit_name }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="text-muted text-center" style="padding: 20px;">
                    Select a formula to see materials
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 8px;">
                <div class="form-group">
                    <label class="form-label">Actual Qty</label>
                    <input v-model.number="form.actual_qty" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Time (hrs)</label>
                    <input v-model.number="form.production_time" type="number" class="input-field" step="0.5" />
                </div>
                <div class="form-group">
                    <label class="form-label">Operator</label>
                    <input v-model="form.operator_name" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Supervisor</label>
                    <input v-model="form.supervisor_name" type="text" class="input-field" />
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
const data = ref([])
const formulas = ref([])
const products = ref([])
const godowns = ref([])
const machines = ref([])
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const filter = reactive({ status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    batch_number: '',
    formula_id: '',
    product_id: '',
    planned_qty: 0,
    batch_date: new Date().toISOString().slice(0, 10),
    godown_id: '',
    shift: 'morning',
    notes: '',
    machine_id: '',
    actual_qty: 0,
    production_time: 0,
    operator_name: '',
    supervisor_name: '',
    items: []
})

const errors = reactive({})
const touched = reactive({})

const selectedFormula = computed(() => formulas.value.find(f => f.id === form.formula_id))

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

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

async function loadMachines() {
    try {
        const response = await api.get('/production/machines')
        if (response.data.success) machines.value = response.data.data
    } catch (error) { console.error(error) }
}

function onFormulaChange() {
    const formula = formulas.value.find(f => f.id === form.formula_id)
    if (formula) {
        form.product_id = formula.product_id
        form.items = formula.items?.map(item => ({
            material_id: item.raw_material_id,
            material_name: item.material_name,
            required_qty: (item.quantity * form.planned_qty) / 1000,
            consumed_qty: 0,
            unit_id: item.unit_id,
            unit_name: item.unit_name
        })) || []
    }
}

function openModal() {
    editing.value = null
    form.batch_number = ''
    form.formula_id = ''
    form.product_id = ''
    form.planned_qty = 0
    form.batch_date = new Date().toISOString().slice(0, 10)
    form.godown_id = ''
    form.shift = 'morning'
    form.notes = ''
    form.machine_id = ''
    form.actual_qty = 0
    form.production_time = 0
    form.operator_name = ''
    form.supervisor_name = ''
    form.items = []
    showModal.value = true
}

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
    
    saving.value = true
    try {
        await api.post('/production/batches', form)
        window.showToast?.({ type: 'success', message: 'Batch created' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed: ' + (error.response?.data?.error?.message || error.message) }) }
    finally { saving.value = false }
}

onMounted(() => { loadData(); loadFormulas(); loadProducts(); loadGodowns(); loadMachines() })
</script>

<style scoped>
.info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: var(--bg-secondary); padding: 10px; border-radius: 4px; margin-top: 12px; }
.info-item { display: flex; flex-direction: column; gap: 2px; }
.info-label { font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 500; }
.info-value { font-size: var(--font-size-sm); color: var(--text-primary); font-weight: 500; }
.items-section { margin-top: 12px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; margin: 0; }
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
