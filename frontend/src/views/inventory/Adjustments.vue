<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.adjustments') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Adjustment</button>
        </div>

        <div class="toolbar">
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Adjustment #</th>
                        <th>Date</th>
                        <th>Godown</th>
                        <th>Items</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.adjustment_number }}</td>
                        <td>{{ item.adjustment_date }}</td>
                        <td>{{ item.godown_name }}</td>
                        <td class="text-center">{{ item.item_count || 0 }}</td>
                        <td>{{ item.reason }}</td>
                        <td><span :class="['badge', item.status === 'completed' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="approve(item)">✅</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="7" class="text-center text-muted">No adjustments found</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">Stock Adjustment</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Godown *</label>
                            <select v-model="form.godown_id" class="select-field" required @change="loadStockItems">
                                <option value="">Select</option>
                                <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input v-model="form.adjustment_date" type="date" class="input-field" required />
                        </div>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Reason</label>
                            <select v-model="form.reason" class="select-field">
                                <option value="">Select Reason</option>
                                <option value="damaged">Damaged</option>
                                <option value="expired">Expired</option>
                                <option value="theft">Theft/Loss</option>
                                <option value="count_error">Count Error</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <input v-model="form.notes" class="input-field" />
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="section-header">
                            <h4>Items</h4>
                            <button type="button" class="btn btn-sm" @click="addItem" :disabled="!form.godown_id">+ Add Item</button>
                        </div>
                        <table class="sheet-grid">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Current Stock</th>
                                    <th>Adjustment</th>
                                    <th>New Stock</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in form.items" :key="idx">
                                    <td>
                                        <select v-model="item.item_id" class="select-field" @change="selectItem(item)">
                                            <option value="">Select</option>
                                            <option v-for="s in stockItems" :key="s.item_id" :value="s.item_id">{{ s.item_name }}</option>
                                        </select>
                                    </td>
                                    <td class="font-mono text-right">{{ item.current_stock || 0 }}</td>
                                    <td>
                                        <div class="adj-input">
                                            <select v-model="item.type" class="select-field" style="width: 80px;">
                                                <option value="add">Add</option>
                                                <option value="remove">Remove</option>
                                            </select>
                                            <input v-model.number="item.quantity" type="number" class="input-field" style="width: 80px;" />
                                        </div>
                                    </td>
                                    <td class="font-mono text-right">{{ calcNewStock(item) }}</td>
                                    <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                                </tr>
                            </tbody>
                        </table>
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
const stockItems = ref([])
const showModal = ref(false)
const meta = reactive({ total: 0 })

const form = reactive({
    godown_id: '', adjustment_date: new Date().toISOString().slice(0, 10),
    reason: '', notes: '', items: []
})

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/inventory/adjustments')
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

async function loadStockItems() {
    if (!form.godown_id) return
    try {
        const response = await api.get(`/inventory/stock/raw_material`, { params: { godown_id: form.godown_id } })
        if (response.data.success) stockItems.value = response.data.data
    } catch (error) { console.error(error) }
}

function selectItem(item) {
    const s = stockItems.value.find(i => i.item_id === item.item_id)
    if (s) {
        item.current_stock = s.qty
        item.item_type = s.item_type
    }
}

function calcNewStock(item) {
    if (!item.current_stock) return '-'
    const adj = item.type === 'add' ? (item.quantity || 0) : -(item.quantity || 0)
    return item.current_stock + adj
}

function addItem() {
    form.items.push({ item_id: '', item_type: 'raw_material', current_stock: 0, type: 'remove', quantity: 0 })
}

function removeItem(idx) { form.items.splice(idx, 1) }

function openModal() {
    Object.assign(form, { godown_id: '', adjustment_date: new Date().toISOString().slice(0, 10), reason: '', notes: '', items: [] })
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    form.items = []
}

async function view(item) { console.log(item) }

async function approve(item) {
    try {
        await api.post(`/inventory/adjustments/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Adjustment approved' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    if (!form.godown_id || !form.reason) {
        window.showToast?.({ type: 'error', message: 'Please fill required fields' })
        return
    }
    if (form.items.length === 0) {
        window.showToast?.({ type: 'error', message: 'Please add at least one item' })
        return
    }
    try {
        await api.post('/inventory/adjustments', form)
        window.showToast?.({ type: 'success', message: 'Adjustment created' })
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
.adj-input { display: flex; gap: 4px; }
</style>
