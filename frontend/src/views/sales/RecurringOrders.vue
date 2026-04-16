<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Recurring Orders</h1>
            <button class="btn btn-primary" @click="openModal()">+ Create</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No recurring orders found.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Ref No</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Frequency</th>
                        <th>Next Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.reference_number }}</td>
                        <td>{{ item.customer_name }}</td>
                        <td>{{ item.product_name }}</td>
                        <td>{{ item.quantity }}</td>
                        <td>{{ item.frequency }}</td>
                        <td>{{ item.next_execution_date || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" title="Create Recurring Order" size="md" :loading="saving">
            <div class="form-row-4">
                <div class="form-group span-2">
                    <label class="form-label">Customer *</label>
                    <select v-model="form.customer_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Product *</label>
                    <select v-model="form.product_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Quantity *</label>
                    <input v-model="form.quantity" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Frequency *</label>
                    <select v-model="form.frequency" class="select-field">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                    </select>
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Start Date *</label>
                    <input v-model="form.start_date" type="date" class="input-field" />
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Creating...' : 'Create' }}</button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const customers = ref([])
const products = ref([])
const showModal = ref(false)

const form = reactive({ customer_id: '', product_id: '', quantity: '', frequency: 'monthly', start_date: '' })

async function loadData() {
    loading.value = true
    try {
        const [ordersRes, customersRes, productsRes] = await Promise.all([
            api.get('/master/recurring-orders'),
            api.get('/master/customers'),
            api.get('/master/products')
        ])
        if (ordersRes.data.success) data.value = ordersRes.data.data
        if (customersRes.data.success) customers.value = customersRes.data.data
        if (productsRes.data.success) products.value = productsRes.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    Object.assign(form, { customer_id: '', product_id: '', quantity: '', frequency: 'monthly', start_date: '' })
    showModal.value = true
}

async function save() {
    if (!form.customer_id || !form.product_id || !form.quantity) {
        window.showToast?.({ type: 'error', message: 'All required fields must be filled' })
        return
    }
    saving.value = true
    try {
        await api.post('/master/recurring-orders', form)
        window.showToast?.({ type: 'success', message: 'Created successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed to create' })
    } finally {
        saving.value = false
    }
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Recurring Order',
        message: `Delete order ${item.reference_number}?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/recurring-orders/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>