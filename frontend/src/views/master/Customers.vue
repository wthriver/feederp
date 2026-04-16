<template>
    <div class="data-page">
        <div class="page-header">
            <div class="page-header-left">
                <h1>{{ $t('nav.customers') }}</h1>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" @click="openModal()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Customer
                </button>
            </div>
        </div>

        <div class="toolbar">
            <div class="search-box">
                <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            </div>

            <div class="filter-group">
                <select v-model="filter.type" class="toolbar-select" @change="loadData">
                    <option value="">All Types</option>
                    <option value="dealer">Dealer</option>
                    <option value="retailer">Retailer</option>
                    <option value="direct">Direct</option>
                    <option value="government">Government</option>
                </select>
            </div>

            <div class="spacer"></div>

            <button class="btn btn-sm" @click="loadData" title="Refresh">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
            </button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Phone</th>
                        <th>City</th>
                        <th style="width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id" @click="editItem(item)" style="cursor: pointer;">
                        <td class="mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-info">{{ item.type }}</span></td>
                        <td>{{ item.phone || item.mobile || '-' }}</td>
                        <td>{{ item.city || '-' }}</td>
                        <td>
                            <div class="action-cell">
                                <button class="action-btn" @click.stop="editItem(item)" title="Edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="action-btn danger" @click.stop="deleteItem(item)" title="Delete">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="6" class="text-center text-muted" style="padding: 40px;">
                            No customers found
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Showing {{ data.length }} of {{ meta.total }} customers</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="changePage(meta.page - 1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <span class="page-info">Page {{ meta.page }}</span>
                <button class="pagination-btn" @click="changePage(meta.page + 1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Customer' : 'Add Customer'" size="lg" :close-on-overlay="!saving" :loading="saving">
            <div v-if="errors.global" class="error-message mb-2">{{ errors.global }}</div>
            
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" :class="{ 'input-error': errors.code }" placeholder="CUS001" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" :class="{ 'input-error': errors.name }" placeholder="Customer name" />
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select v-model="form.type" class="select-field">
                        <option value="dealer">Dealer</option>
                        <option value="retailer">Retailer</option>
                        <option value="direct">Direct</option>
                        <option value="government">Government</option>
                        <option value="corporate">Corporate</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select v-model="form.is_active" class="select-field">
                        <option :value="1">Active</option>
                        <option :value="0">Inactive</option>
                    </select>
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Contact Person</label>
                    <input v-model="form.contact_person" class="input-field" placeholder="Contact name" />
                </div>
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input v-model="form.phone" class="input-field" placeholder="Phone" />
                </div>
                <div class="form-group">
                    <label class="form-label">Mobile</label>
                    <input v-model="form.mobile" class="input-field" placeholder="Mobile" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Email</label>
                    <input v-model="form.email" type="email" class="input-field" placeholder="email@example.com" />
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group span-2">
                    <label class="form-label">Address</label>
                    <input v-model="form.address" class="input-field" placeholder="Address" />
                </div>
                <div class="form-group">
                    <label class="form-label">City</label>
                    <input v-model="form.city" class="input-field" placeholder="City" />
                </div>
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input v-model="form.state" class="input-field" placeholder="State" />
                </div>
                <div class="form-group">
                    <label class="form-label">Pincode</label>
                    <input v-model="form.pincode" class="input-field" placeholder="123456" />
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">GSTIN</label>
                    <input v-model="form.gstin" class="input-field" placeholder="GSTIN" />
                </div>
                <div class="form-group">
                    <label class="form-label">TIN</label>
                    <input v-model="form.tin" class="input-field" placeholder="TIN" />
                </div>
                <div class="form-group">
                    <label class="form-label">Credit Limit</label>
                    <input v-model.number="form.credit_limit" type="number" class="input-field" placeholder="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">Price List</label>
                    <select v-model="form.price_list_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="p in priceLists" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Payment Terms</label>
                    <select v-model="form.payment_terms" class="select-field">
                        <option value="NET15">Net 15</option>
                        <option value="NET30">Net 30</option>
                        <option value="NET45">Net 45</option>
                        <option value="NET60">Net 60</option>
                        <option value="IMMEDIATE">Immediate</option>
                    </select>
                </div>
            </div>

            <template #footer>
                <button class="btn" @click="showModal = false" :disabled="saving">{{ $t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="save" :disabled="saving">
                    {{ saving ? 'Saving...' : $t('common.save') }}
                </button>
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
const routes = ref([])
const priceLists = ref([])
const showModal = ref(false)
const editing = ref(null)
const search = ref('')
const filter = reactive({ type: '' })
const meta = reactive({ page: 1, total: 0 })
const errors = reactive({})

const form = reactive({
    code: '', name: '', name_bn: '', type: 'retail', route_id: '', contact_person: '', phone: '', mobile: '', email: '',
    address: '', city: '', state: '', pincode: '', gstin: '', tin: '', credit_limit: 0, price_list_id: '',
    payment_terms: 'NET30', opening_balance: 0, is_active: true
})

async function loadRoutes() {
    try {
        const response = await api.get('/master/routes')
        if (response.data.success) routes.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadPriceLists() {
    try {
        const response = await api.get('/master/price-lists')
        if (response.data.success) priceLists.value = response.data.data
    } catch (error) { console.error(error) }
}

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
        const response = await api.get('/master/customers', { params: { search: search.value, type: filter.type } })
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
        code: '', name: '', name_bn: '', type: 'retail', route_id: '', contact_person: '', phone: '', mobile: '', email: '',
        address: '', city: '', state: '', pincode: '', gstin: '', tin: '', credit_limit: 0, price_list_id: '',
        payment_terms: 'NET30', opening_balance: 0, is_active: true
    })
    Object.keys(errors).forEach(k => delete errors[k])
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, {
        ...item,
        credit_limit: item.credit_limit || 0,
        opening_balance: item.opening_balance || 0,
        is_active: item.is_active === 1 || item.is_active === true
    })
    Object.keys(errors).forEach(k => delete errors[k])
    showModal.value = true
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Customer',
        message: `Are you sure you want to delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/customers/${item.id}`)
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
            await api.put(`/master/customers/${editing.value.id}`, payload)
            window.showToast?.({ type: 'success', message: 'Customer updated successfully' })
        } else {
            await api.post('/master/customers', payload)
            window.showToast?.({ type: 'success', message: 'Customer created successfully' })
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

onMounted(() => { loadData(); loadRoutes(); loadPriceLists() })
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
