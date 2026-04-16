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

        <AppModal v-model="showModal" :title="'Stock Adjustment'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Adjustment #</label>
                    <input type="text" class="input-field" :value="form.adjustment_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group">
                    <label class="form-label">Date *</label>
                    <input v-model="form.adjustment_date" type="date" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Godown *</label>
                    <select v-model="form.godown_id" class="select-field" required @change="loadStockItems">
                        <option value="">Select</option>
                        <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Reason *</label>
                    <select v-model="form.reason" class="select-field">
                        <option value="">Select</option>
                        <option value="damaged">Damaged</option>
                        <option value="expired">Expired</option>
                        <option value="theft">Theft/Loss</option>
                        <option value="count_error">Count Error</option>
                        <option value="found">Found</option>
                        <option value="sample">Sample</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Supervisor</label>
                    <input v-model="form.supervisor" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Checked By</label>
                    <input v-model="form.checked_by" type="text" class="input-field" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Notes</label>
                    <input v-model="form.notes" class="input-field" />
                </div>
            </div>

            <div class="items-section">
                <div class="section-header">
                    <h4>Items</h4>
                    <button type="button" class="btn btn-sm" @click="addItem" :disabled="!form.godown_id">+ Add</button>
                </div>
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Item</th>
                            <th style="width: 80px;">Current</th>
                            <th style="width: 120px;">Adjustment</th>
                            <th style="width: 80px;">New</th>
                            <th style="width: 100px;">Batch</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in form.items" :key="idx">
                            <td class="text-center">{{ idx + 1 }}</td>
                            <td>
                                <select v-model="item.item_id" class="table-select" @change="selectItem(item)">
                                    <option value="">Select</option>
                                    <option v-for="s in stockItems" :key="s.item_id" :value="s.item_id">{{ s.item_name }}</option>
                                </select>
                            </td>
                            <td class="font-mono text-right">{{ item.current_stock || 0 }}</td>
                            <td>
                                <div class="adj-input">
                                    <select v-model="item.type" class="table-select" style="width: 60px;">
                                        <option value="add">Add</option>
                                        <option value="remove">Rem</option>
                                    </select>
                                    <input v-model.number="item.quantity" type="number" class="table-input" style="width: 50px;" />
                                </div>
                            </td>
                            <td class="font-mono text-right">{{ calcNewStock(item) }}</td>
                            <td>
                                <input v-model="item.batch_number" type="text" class="table-input" />
                            </td>
                            <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Net:</strong></td>
                            <td class="font-mono text-right" :class="{ 'text-success': netAdjustment > 0, 'text-danger': netAdjustment < 0 }">
                                {{ netAdjustment > 0 ? '+' : '' }}{{ netAdjustment }}
                            </td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="form-group" style="margin-top: 8px;">
                <label class="form-label">Remarks</label>
                <textarea v-model="form.remarks" class="input-field" rows="2"></textarea>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal">Cancel</button>
                <button class="btn btn-primary" @click="save">Save</button>
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
const godowns = ref([])
const stockItems = ref([])
const showModal = ref(false)
const meta = reactive({ total: 0 })

const form = reactive({
    godown_id: '', adjustment_date: new Date().toISOString().slice(0, 10),
    adjustment_number: '', reason: '', reference_number: '',
    supervisor: '', checked_by: '', notes: '', remarks: '',
    items: []
})

const netAdjustment = computed(() => {
    return form.items.reduce((sum, item) => {
        const adj = item.type === 'add' ? (item.quantity || 0) : -(item.quantity || 0)
        return sum + adj
    }, 0)
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
        const rmResponse = await api.get(`/inventory/stock/raw_material`, { params: { godown_id: form.godown_id } })
        const prodResponse = await api.get(`/inventory/stock/product`, { params: { godown_id: form.godown_id } })
        
        const rmItems = rmResponse.data.success ? rmResponse.data.data : []
        const prodItems = prodResponse.data.success ? prodResponse.data.data : []
        
        stockItems.value = [...rmItems, ...prodItems]
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
    Object.assign(form, {
        godown_id: '', adjustment_date: new Date().toISOString().slice(0, 10),
        adjustment_number: '', reason: '', reference_number: '',
        supervisor: '', checked_by: '', notes: '', remarks: '',
        items: []
    })
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
    saving.value = true
    try {
        if (!form.godown_id || !form.reason) {
            window.showToast?.({ type: 'error', message: 'Please fill required fields' })
            return
        }
        if (form.items.length === 0) {
            window.showToast?.({ type: 'error', message: 'Please add at least one item' })
            return
        }
        const hasInvalidItems = form.items.some(item => !item.item_id || !item.quantity)
        if (hasInvalidItems) {
            window.showToast?.({ type: 'error', message: 'Please fill all item details' })
            return
        }
        await api.post('/inventory/adjustments', form)
        window.showToast?.({ type: 'success', message: 'Adjustment created' })
        closeModal()
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

onMounted(() => { loadData(); loadGodowns() })
</script>

<style scoped>
.items-section { margin-top: 12px; }
.section-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.section-header h4 { font-size: var(--font-size-base); font-weight: 600; margin: 0; }
.adj-input { display: flex; gap: 4px; align-items: center; }
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
