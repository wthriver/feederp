<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Discount Rules</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No discount rules found. Create your first discount rule.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Min Amount</th>
                        <th>Valid From</th>
                        <th>Valid To</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td>{{ item.name }}</td>
                        <td>{{ item.discount_type }}</td>
                        <td>{{ item.discount_value }}{{ item.discount_type === 'percentage' ? '%' : '₹' }}</td>
                        <td>₹{{ item.min_amount || 0 }}</td>
                        <td>{{ item.valid_from || '-' }}</td>
                        <td>{{ item.valid_to || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">Add Discount Rule</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input v-model="form.name" class="input-field" placeholder="Festival Discount" />
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select v-model="form.discount_type" class="select-field">
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed Amount</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Value *</label>
                            <input v-model="form.discount_value" type="number" class="input-field" placeholder="10" />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Min Amount</label>
                            <input v-model="form.min_amount" type="number" class="input-field" placeholder="0" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Priority</label>
                            <input v-model="form.priority" type="number" class="input-field" placeholder="1" />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Valid From</label>
                            <input v-model="form.valid_from" type="date" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Valid To</label>
                            <input v-model="form.valid_to" type="date" class="input-field" />
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false">Cancel</button>
                    <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const showModal = ref(false)

const form = reactive({ name: '', discount_type: 'percentage', discount_value: '', min_amount: 0, priority: 1, valid_from: '', valid_to: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/discount-rules')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    Object.assign(form, { name: '', discount_type: 'percentage', discount_value: '', min_amount: 0, priority: 1, valid_from: '', valid_to: '' })
    showModal.value = true
}

async function save() {
    if (!form.name || !form.discount_value) {
        window.showToast?.({ type: 'error', message: 'Name and value are required' })
        return
    }
    saving.value = true
    try {
        await api.post('/master/discount-rules', form)
        window.showToast?.({ type: 'success', message: 'Created successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed' })
    } finally {
        saving.value = false
    }
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Discount Rule',
        message: `Delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/discount-rules/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>