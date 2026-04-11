<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.transfers') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Transfer</button>
        </div>

        <div class="toolbar">
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
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
                        <th>Transfer #</th>
                        <th>Date</th>
                        <th>From Godown</th>
                        <th>To Godown</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.transfer_number }}</td>
                        <td>{{ item.transfer_date }}</td>
                        <td>{{ item.from_godown }}</td>
                        <td>{{ item.to_godown }}</td>
                        <td class="text-center">{{ item.item_count || 0 }}</td>
                        <td><span :class="['badge', item.status === 'completed' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="approve(item)">✅</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="7" class="text-center text-muted">No transfers found</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal" style="max-width: 900px;">
                <div class="modal-header">
                    <h3 class="modal-title">Stock Transfer</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-3">
                        <div class="form-group">
                            <label class="form-label">From Godown *</label>
                            <select v-model="form.from_godown_id" class="select-field" required @change="loadSourceItems">
                                <option value="">Select</option>
                                <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">To Godown *</label>
                            <select v-model="form.to_godown_id" class="select-field" required>
                                <option value="">Select</option>
                                <option v-for="g in godowns.filter(g => g.id !== form.from_godown_id)" :key="g.id" :value="g.id">{{ g.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Transfer Date *</label>
                            <input v-model="form.transfer_date" type="date" class="input-field" required />
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="section-header">
                            <h4>Items</h4>
                            <button type="button" class="btn btn-sm" @click="addItem" :disabled="!form.from_godown_id">+ Add Item</button>
                        </div>
                        <table class="sheet-grid">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Available</th>
                                    <th>Transfer Qty</th>
                                    <th>Unit</th>
                                    <th>Batch</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in form.items" :key="idx">
                                    <td>
                                        <select v-model="item.item_id" class="select-field" @change="selectItem(item)">
                                            <option value="">Select</option>
                                            <option v-for="s in sourceItems" :key="s.item_id" :value="s.item_id">{{ s.item_name }} ({{ s.batch_number }})</option>
                                        </select>
                                    </td>
                                    <td class="font-mono text-right">{{ item.available_qty || 0 }}</td>
                                    <td><input v-model.number="item.quantity" type="number" class="input-field" :max="item.available_qty" /></td>
                                    <td>{{ item.unit_name }}</td>
                                    <td>
                                        <input v-model="item.batch_number" type="text" class="input-field" readonly />
                                    </td>
                                    <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notes</label>
                        <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
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
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const godowns = ref([])
const sourceItems = ref([])
const showModal = ref(false)
const filter = reactive({ status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    from_godown_id: '', to_godown_id: '', transfer_date: new Date().toISOString().slice(0, 10),
    items: [], notes: ''
})

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/inventory/transfers', { params: filter })
        if (response.data.success) {
            data.value = response.data.data
            meta.total = data.value.length
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadGodowns() {
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) godowns.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadSourceItems() {
    if (!form.from_godown_id) return
    form.items = []
    try {
        const response = await api.get(`/inventory/stock/raw_material`, { params: { godown_id: form.from_godown_id } })
        if (response.data.success) sourceItems.value = response.data.data.filter(s => s.qty > 0)
    } catch (error) { console.error(error) }
}

function selectItem(item) {
    const s = sourceItems.value.find(i => i.item_id === item.item_id)
    if (s) {
        item.available_qty = s.qty
        item.batch_number = s.batch_number
        item.unit_name = s.unit_name
        item.quantity = Math.min(s.qty, 1)
    }
}

function addItem() {
    form.items.push({ item_id: '', item_type: 'raw_material', available_qty: 0, quantity: 0, unit_name: '', batch_number: '' })
}

function removeItem(idx) { form.items.splice(idx, 1) }

function openModal() {
    Object.assign(form, { from_godown_id: '', to_godown_id: '', transfer_date: new Date().toISOString().slice(0, 10), items: [], notes: '' })
    sourceItems.value = []
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    form.items = []
}

async function view(item) {
    try {
        const response = await api.get(`/inventory/transfers/${item.id}`)
        if (response.data.success) console.log(response.data.data)
    } catch (error) { console.error(error) }
}

async function approve(item) {
    try {
        await api.post(`/inventory/transfers/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Transfer approved' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    if (!form.from_godown_id || !form.to_godown_id) {
        window.showToast?.({ type: 'error', message: 'Please select godowns' })
        return
    }
    if (form.items.length === 0) {
        window.showToast?.({ type: 'error', message: 'Please add at least one item' })
        return
    }
    try {
        await api.post('/inventory/transfers', form)
        window.showToast?.({ type: 'success', message: 'Transfer created' })
        closeModal()
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(() => { loadData(); loadGodowns() })
</script>

<style scoped>
.items-section { margin-top: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; }
.items-section table { margin-top: 8px; }
.items-section table th, .items-section table td { padding: 6px; }
.items-section table .input-field, .items-section table .select-field { width: 100%; padding: 4px 8px; font-size: var(--font-size-sm); }
</style>
