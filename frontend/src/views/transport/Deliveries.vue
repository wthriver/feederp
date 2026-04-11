<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.deliveries') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Delivery</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>DO #</th>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.do_number }}</td>
                        <td>{{ item.scheduled_date }}</td>
                        <td class="font-mono">{{ item.invoice_number }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td>{{ item.vehicle_number || '-' }}</td>
                        <td>{{ item.driver_name || '-' }}</td>
                        <td><span :class="['badge', statusClass(item.status)]">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="dispatch(item)">🚚</button>
                            <button v-if="item.status === 'in_transit'" class="btn btn-sm btn-icon" @click="delivered(item)">✅</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="8" class="text-center text-muted">No deliveries found</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'New' }} Delivery Order</h3>
                    <button class="modal-close" @click="closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Invoice *</label>
                        <select v-model="form.invoice_id" class="select-field" required>
                            <option value="">Select Invoice</option>
                            <option v-for="inv in invoices" :key="inv.id" :value="inv.id">{{ inv.invoice_number }} - {{ inv.customer_name }}</option>
                        </select>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Scheduled Date *</label>
                            <input v-model="form.scheduled_date" type="date" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Vehicle</label>
                            <select v-model="form.vehicle_id" class="select-field">
                                <option value="">Select Vehicle</option>
                                <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.vehicle_number }} ({{ v.type }})</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Driver</label>
                            <select v-model="form.driver_id" class="select-field">
                                <option value="">Select Driver</option>
                                <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }} - {{ d.phone }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Contact Number</label>
                            <input v-model="form.contact_number" class="input-field" placeholder="Customer contact" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Delivery Address</label>
                        <textarea v-model="form.delivery_address" class="input-field" rows="2"></textarea>
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
const invoices = ref([])
const vehicles = ref([])
const drivers = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ search: '', status: '' })
const meta = reactive({ total: 0 })

const form = reactive({
    invoice_id: '', scheduled_date: new Date().toISOString().slice(0, 10),
    vehicle_id: '', driver_id: '', contact_number: '', delivery_address: '', notes: ''
})

function statusClass(status) {
    const classes = { pending: 'badge-warning', assigned: 'badge-info', in_transit: 'badge-primary', delivered: 'badge-success', returned: 'badge-danger' }
    return classes[status] || 'badge-secondary'
}

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/transport/delivery-orders', { params: { ...filter } })
        if (response.data.success) {
            data.value = response.data.data
            meta.total = response.data.meta?.total || data.value.length
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadInvoices() {
    try {
        const response = await api.get('/sales/invoices')
        if (response.data.success) invoices.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadVehicles() {
    try {
        const response = await api.get('/transport/vehicles')
        if (response.data.success) vehicles.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadDrivers() {
    try {
        const response = await api.get('/transport/drivers')
        if (response.data.success) drivers.value = response.data.data
    } catch (error) { console.error(error) }
}

function openModal() {
    editing.value = null
    Object.assign(form, { invoice_id: '', scheduled_date: new Date().toISOString().slice(0, 10), vehicle_id: '', driver_id: '', contact_number: '', delivery_address: '', notes: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function view(item) {
    try {
        const response = await api.get(`/transport/delivery-orders/${item.id}`)
        if (response.data.success) {
            console.log(response.data.data)
        }
    } catch (error) { console.error(error) }
}

async function dispatch(item) {
    try {
        await api.post(`/transport/delivery-orders/${item.id}/dispatch`)
        window.showToast?.({ type: 'success', message: 'Dispatched' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function delivered(item) {
    try {
        await api.post(`/transport/delivery-orders/${item.id}/delivered`)
        window.showToast?.({ type: 'success', message: 'Delivered' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function save() {
    if (!form.invoice_id || !form.scheduled_date) {
        window.showToast?.({ type: 'error', message: 'Please fill required fields' })
        return
    }
    try {
        if (editing.value) {
            await api.put(`/transport/delivery-orders/${editing.value.id}`, form)
        } else {
            await api.post('/transport/delivery-orders', form)
        }
        window.showToast?.({ type: 'success', message: 'Saved' })
        closeModal()
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

function closeModal() {
    showModal.value = false
    editing.value = null
}

onMounted(() => { loadData(); loadInvoices(); loadVehicles(); loadDrivers() })
</script>
