<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.suppliers') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ {{ $t('common.add') }}</button>
        </div>

        <div class="toolbar">
            <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Contact Person</th>
                        <th>Phone</th>
                        <th>GSTIN</th>
                        <th>Credit Limit</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.contact_person }}</td>
                        <td>{{ item.phone }}</td>
                        <td class="font-mono">{{ item.gstin }}</td>
                        <td class="font-mono">₹{{ item.credit_limit?.toLocaleString() }}</td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'Add' }} Supplier</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div v-if="errors.global" class="error-message mb-3">{{ errors.global }}</div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">{{ $t('common.code') }} *</label>
                            <input v-model="form.code" class="input-field" :class="{ 'input-error': errors.code }" placeholder="e.g., SUP001" />
                            <span v-if="errors.code" class="error-text">{{ errors.code }}</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ $t('common.name') }} *</label>
                            <input v-model="form.name" class="input-field" :class="{ 'input-error': errors.name }" placeholder="Supplier name" />
                            <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Contact Person</label>
                            <input v-model="form.contact_person" class="input-field" placeholder="Contact person name" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phone</label>
                            <input v-model="form.phone" class="input-field" placeholder="Phone number" />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Mobile</label>
                            <input v-model="form.mobile" class="input-field" placeholder="Mobile number" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input v-model="form.email" type="email" class="input-field" :class="{ 'input-error': errors.email }" placeholder="email@example.com" />
                            <span v-if="errors.email" class="error-text">{{ errors.email }}</span>
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">GST Number</label>
                            <input v-model="form.gstin" class="input-field font-mono" placeholder="GSTIN number" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">PAN Number</label>
                            <input v-model="form.pan" class="input-field font-mono" placeholder="PAN number" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Address</label>
                        <textarea v-model="form.address" class="input-field" rows="2" placeholder="Full address"></textarea>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">City</label>
                            <input v-model="form.city" class="input-field" placeholder="City" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">State</label>
                            <input v-model="form.state" class="input-field" placeholder="State" />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Credit Limit</label>
                            <input v-model.number="form.credit_limit" type="number" min="0" class="input-field" placeholder="0" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Payment Terms</label>
                            <select v-model="form.payment_terms" class="input-field">
                                <option value="NET15">Net 15</option>
                                <option value="NET30">Net 30</option>
                                <option value="NET45">Net 45</option>
                                <option value="NET60">Net 60</option>
                                <option value="IMMEDIATE">Immediate</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" v-model="form.is_active" class="mr-2" />
                            Active
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
                    <button class="btn btn-primary" @click="save" :disabled="saving">
                        {{ saving ? 'Saving...' : $t('common.save') }}
                    </button>
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
const editing = ref(null)
const search = ref('')
const meta = reactive({ page: 1, total: 0 })
const errors = reactive({})

const form = reactive({
    code: '', name: '', name_bn: '', contact_person: '', phone: '', mobile: '', email: '', address: '',
    city: '', state: '', gstin: '', pan: '', payment_terms: 'NET30', credit_limit: 0, is_active: true
})

function debounceLoad() { setTimeout(loadData, 300) }

function validateForm() {
    Object.keys(errors).forEach(k => delete errors[k])
    let isValid = true

    if (!form.code?.trim()) {
        errors.code = 'Code is required'
        isValid = false
    }
    if (!form.name?.trim()) {
        errors.name = 'Name is required'
        isValid = false
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Invalid email format'
        isValid = false
    }
    return isValid
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/suppliers', { params: { search: search.value } })
        if (response.data.success) {
            data.value = response.data.data
            if (response.data.pagination) {
                meta.total = response.data.pagination.total
            }
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, {
        code: '', name: '', name_bn: '', contact_person: '', phone: '', mobile: '', email: '', address: '',
        city: '', state: '', gstin: '', pan: '', payment_terms: 'NET30', credit_limit: 0, is_active: true
    })
    Object.keys(errors).forEach(k => delete errors[k])
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, {
        ...item,
        credit_limit: item.credit_limit || 0,
        is_active: item.is_active === 1 || item.is_active === true
    })
    Object.keys(errors).forEach(k => delete errors[k])
    showModal.value = true
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Supplier',
        message: `Are you sure you want to delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/suppliers/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

async function save() {
    if (!validateForm()) return
    
    saving.value = true
    try {
        const payload = { ...form }
        if (editing.value) {
            await api.put(`/master/suppliers/${editing.value.id}`, payload)
            window.showToast?.({ type: 'success', message: 'Supplier updated successfully' })
        } else {
            await api.post('/master/suppliers', payload)
            window.showToast?.({ type: 'success', message: 'Supplier created successfully' })
        }
        showModal.value = false
        loadData()
    } catch (error) {
        if (error.response?.data?.error?.details) {
            error.response.data.error.details.forEach(d => {
                errors[d.field] = d.message
            })
        } else {
            errors.global = error.response?.data?.error?.message || 'Save failed'
        }
    } finally {
        saving.value = false
    }
}

onMounted(loadData)
</script>

<style scoped>
.input-error {
    border-color: #e74c3c !important;
    background-color: #fdf2f2;
}
.error-text {
    color: #e74c3c;
    font-size: 12px;
    margin-top: 4px;
}
.error-message {
    color: #e74c3c;
    background: #fdf2f2;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #f5c6cb;
}
.mb-3 { margin-bottom: 12px; }
.mr-2 { margin-right: 8px; }
</style>
