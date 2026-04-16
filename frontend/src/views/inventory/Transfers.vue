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

        <AppModal v-model="showModal" :title="'Stock Transfer'" size="lg" :loading="saving" @close="closeModal">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Transfer #</label>
                    <input type="text" class="input-field" :value="form.transfer_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group">
                    <label class="form-label">Transfer Date *</label>
                    <input v-model="form.transfer_date" type="date" class="input-field" required />
                </div>
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
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select v-model="form.priority" class="select-field">
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Vehicle</label>
                    <input v-model="form.vehicle_number" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Driver</label>
                    <input v-model="form.driver_name" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input v-model="form.driver_phone" type="text" class="input-field" />
                </div>
            </div>

            <div class="items-section">
                <div class="section-header">
                    <h4>Items</h4>
                    <button type="button" class="btn btn-sm" @click="addItem" :disabled="!form.from_godown_id">+ Add</button>
                </div>
                <table class="sheet-grid">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Item</th>
                            <th style="width: 80px;">Avail</th>
                            <th style="width: 100px;">Qty</th>
                            <th style="width: 60px;">Unit</th>
                            <th style="width: 100px;">Batch</th>
                            <th style="width: 100px;">Rate</th>
                            <th style="width: 120px;">Amount</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in form.items" :key="idx">
                            <td class="text-center">{{ idx + 1 }}</td>
                            <td>
                                <select v-model="item.item_id" class="table-select" @change="selectItem(item)">
                                    <option value="">Select</option>
                                    <option v-for="s in sourceItems" :key="s.item_id" :value="s.item_id">{{ s.item_name }}</option>
                                </select>
                            </td>
                            <td class="font-mono text-right">{{ item.available_qty || 0 }}</td>
                            <td><input v-model.number="item.quantity" type="number" class="table-input text-right" :max="item.available_qty" @input="calcItemAmount(item)" /></td>
                            <td class="text-center">{{ item.unit_name || '-' }}</td>
                            <td><input v-model="item.batch_number" type="text" class="table-input" readonly /></td>
                            <td><input v-model.number="item.rate" type="number" class="table-input text-right" @input="calcItemAmount(item)" /></td>
                            <td class="font-mono text-right">৳{{ (item.amount || 0).toLocaleString() }}</td>
                            <td><button type="button" class="btn btn-sm btn-icon" @click="removeItem(idx)">🗑️</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-right"><strong>Total:</strong></td>
                            <td class="font-mono text-right"><strong>৳{{ totalAmount.toLocaleString() }}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="form-row-4" style="margin-top: 8px;">
                <div class="form-group">
                    <label class="form-label">Supervisor</label>
                    <input v-model="form.supervisor" type="text" class="input-field" />
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Notes</label>
                    <textarea v-model="form.notes" class="input-field" rows="2"></textarea>
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal">Cancel</button>
                <button class="btn btn-primary" @click="save">Save</button>
            </template>
</AppModal>

        <AppModal v-model="showDetailsModal" :title="`Transfer: ${selectedTransfer?.transfer_number || ''}`" size="lg">
            <div v-if="selectedTransfer" class="transfer-details">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Transfer #</span>
                        <span class="detail-value">{{ selectedTransfer.transfer_number }}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Date</span>
                        <span class="detail-value">{{ selectedTransfer.transfer_date }}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">From Godown</span>
                        <span class="detail-value">{{ selectedTransfer.from_godown }}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">To Godown</span>
                        <span class="detail-value">{{ selectedTransfer.to_godown }}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status</span>
                        <span :class="['badge', selectedTransfer.status === 'completed' ? 'badge-success' : 'badge-warning']">{{ selectedTransfer.status }}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Created By</span>
                        <span class="detail-value">{{ selectedTransfer.created_by }}</span>
                    </div>
                </div>
                
                <h4 class="mt-4">Items</h4>
                <table class="sheet-grid mt-2">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Batch</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in selectedTransfer.items" :key="item.id">
                            <td>{{ item.item_name }}</td>
                            <td>{{ item.batch_number || '-' }}</td>
                            <td class="text-right">{{ item.quantity }}</td>
                            <td class="text-right">৳{{ item.rate }}</td>
                            <td class="text-right">৳{{ item.amount }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
const sourceItems = ref([])
const showModal = ref(false)
const showDetailsModal = ref(false)
const selectedTransfer = ref(null)
const filter = reactive({ status: '', from_date: '', to_date: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    from_godown_id: '', to_godown_id: '', transfer_date: new Date().toISOString().slice(0, 10),
    required_date: '', priority: 'normal', transfer_number: '',
    vehicle_number: '', driver_name: '', driver_phone: '', supervisor: '',
    items: [], notes: ''
})

const totalAmount = computed(() => {
    return form.items.reduce((sum, item) => sum + (item.amount || 0), 0)
})

function calcItemAmount(item) {
    item.amount = (item.quantity || 0) * (item.rate || 0)
}

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
        const rmResponse = await api.get(`/inventory/stock/raw_material`, { params: { godown_id: form.from_godown_id } })
        const prodResponse = await api.get(`/inventory/stock/product`, { params: { godown_id: form.from_godown_id } })
        
        const rmItems = rmResponse.data.success ? rmResponse.data.data : []
        const prodItems = prodResponse.data.success ? prodResponse.data.data : []
        
        sourceItems.value = [...rmItems, ...prodItems].filter(s => s.qty > 0)
    } catch (error) { console.error(error) }
}

function selectItem(item) {
    const s = sourceItems.value.find(i => i.item_id === item.item_id)
    if (s) {
        item.available_qty = s.qty
        item.batch_number = s.batch_number
        item.unit_name = s.unit_name
        item.rate = s.rate || 0
        item.quantity = Math.min(s.qty, 1)
        item.amount = item.quantity * item.rate
    }
}

function addItem() {
    form.items.push({ item_id: '', item_type: 'raw_material', available_qty: 0, quantity: 0, unit_name: '', batch_number: '', rate: 0, amount: 0 })
}

function addProductItem() {
    form.items.push({ item_id: '', item_type: 'product', available_qty: 0, quantity: 0, unit_name: '', batch_number: '', rate: 0, amount: 0 })
}

function removeItem(idx) { form.items.splice(idx, 1) }

function openModal() {
    Object.assign(form, {
        from_godown_id: '', to_godown_id: '', transfer_date: new Date().toISOString().slice(0, 10),
        required_date: '', priority: 'normal', transfer_number: '',
        vehicle_number: '', driver_name: '', driver_phone: '', supervisor: '',
        items: [], notes: ''
    })
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
        if (response.data.success) {
            selectedTransfer.value = response.data.data
            showDetailsModal.value = true
        }
    } catch (error) { 
        window.showToast?.({ type: 'error', message: 'Failed to load details' }) 
    }
}

async function approve(item) {
    try {
        await api.post(`/inventory/transfers/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Transfer approved' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    saving.value = true
    try {
        if (!form.from_godown_id || !form.to_godown_id) {
            window.showToast?.({ type: 'error', message: 'Please select godowns' })
            return
        }
        if (form.items.length === 0) {
            window.showToast?.({ type: 'error', message: 'Please add at least one item' })
            return
        }
        await api.post('/inventory/transfers', form)
        window.showToast?.({ type: 'success', message: 'Transfer created' })
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
.text-right { text-align: right; }
.text-center { text-align: center; }
</style>
