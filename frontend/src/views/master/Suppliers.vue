<template>
    <div class="data-page">
        <div class="page-header">
            <div class="page-header-left">
                <h1>{{ $t('nav.suppliers') }}</h1>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" @click="openModal()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Supplier
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
                <select v-model="filter.is_active" class="toolbar-select" @change="loadData">
                    <option value="">All Status</option>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
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

        <EmptyState 
            v-else-if="data.length === 0" 
            icon="🏭" 
            title="No suppliers found" 
            description="Get started by adding your first supplier."
        >
            <template #action>
                <button class="btn btn-primary" @click="openModal()">+ Add Supplier</button>
            </template>
        </EmptyState>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Phone</th>
                        <th>GSTIN</th>
                        <th class="num">Credit Limit</th>
                        <th style="width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id" @click="editItem(item)" style="cursor: pointer;">
                        <td class="mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.contact_person || '-' }}</td>
                        <td>{{ item.phone || '-' }}</td>
                        <td class="mono">{{ item.gstin || '-' }}</td>
                        <td class="num">৳{{ formatNumber(item.credit_limit) }}</td>
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
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Showing {{ data.length }} of {{ meta.total }} suppliers</div>
            <div class="pagination-controls" v-if="meta.totalPages > 1">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="changePage(meta.page - 1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <span class="page-info">Page {{ meta.page }} of {{ meta.totalPages }}</span>
                <button class="pagination-btn" :disabled="meta.page >= meta.totalPages" @click="changePage(meta.page + 1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Supplier' : 'Add Supplier'" size="lg" :close-on-overlay="!saving" :loading="saving">
            <div v-if="errors.global" class="error-message mb-2">{{ errors.global }}</div>
            
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" :class="{ 'input-error': errors.code }" placeholder="SUP001" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" :class="{ 'input-error': errors.name }" placeholder="Supplier name" />
                </div>
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
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input v-model="form.email" type="email" class="input-field" :class="{ 'input-error': errors.email }" placeholder="email@example.com" />
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input v-model="form.state" class="input-field" placeholder="State" />
                </div>
                <div class="form-group">
                    <label class="form-label">City</label>
                    <input v-model="form.city" class="input-field" placeholder="City" />
                </div>
                <div class="form-group">
                    <label class="form-label">Pincode</label>
                    <input v-model="form.pincode" class="input-field" placeholder="123456" />
                </div>
                <div class="form-group">
                    <label class="form-label">GSTIN</label>
                    <input v-model="form.gstin" class="input-field" placeholder="GSTIN" />
                </div>
                <div class="form-group">
                    <label class="form-label">PAN</label>
                    <input v-model="form.pan" class="input-field" placeholder="PAN" />
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
                <div class="form-group span-2">
                    <label class="form-label">Address</label>
                    <input v-model="form.address" class="input-field" placeholder="Full address" />
                </div>
                <div class="form-group">
                    <label class="form-label">Credit Limit</label>
                    <input v-model.number="form.credit_limit" type="number" class="input-field" placeholder="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">Opening Balance</label>
                    <input v-model.number="form.opening_balance" type="number" class="input-field" placeholder="0" />
                </div>
                <div class="form-group">
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
import EmptyState from '@/components/EmptyState.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const showModal = ref(false)
const editing = ref(null)
const search = ref('')
const filter = reactive({ is_active: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })
const errors = reactive({})

const form = reactive({
    code: '', name: '', name_bn: '', contact_person: '', phone: '', mobile: '', email: '', address: '',
    city: '', state: '', pincode: '', gstin: '', pan: '', payment_terms: 'NET30', credit_limit: 0,
    opening_balance: 0, category: '', is_active: true
})

function debounceLoad() {
    setTimeout(() => { meta.page = 1; loadData() }, 300)
}

function changePage(newPage) {
    meta.page = newPage
    loadData()
}

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
    if (form.email && !/^[^\u0000-\u007F]+@[^\u0000-\u007F]+\u0000-\u007F]+$/.test(form.email)) {
        errors.email = 'Invalid email format'
        isValid = false
    }
    return isValid
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/suppliers', { params: { search: search.value, is_active: filter.is_active, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            if (response.data.meta) {
                meta.total = response.data.meta.total
                meta.totalPages = response.data.meta.totalPages || Math.ceil(meta.total / 50)
            }
        }
    } catch (error) {
        console.error(error)
        toast.error('Failed to load suppliers')
    }
    finally { loading.value = false }
}

function formatNumber(num) {
    if (num === null || num === undefined) return '-'
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

function openModal() {
    editing.value = null
    Object.assign(form, {
        code: '', name: '', name_bn: '', contact_person: '', phone: '', mobile: '', email: '', address: '',
        city: '', state: '', pincode: '', gstin: '', pan: '', payment_terms: 'NET30', credit_limit: 0,
        opening_balance: 0, category: '', is_active: true
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
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return
    try {
        await api.delete(`/master/suppliers/${item.id}`)
        toast.success('Supplier deleted successfully')
        loadData()
    } catch (error) {
        toast.error(error.response?.data?.error?.message || 'Delete failed')
    }
}

async function save() {
    if (!validateForm()) return
    
    saving.value = true
    try {
        const payload = { ...form }
        if (editing.value) {
            await api.put(`/master/suppliers/${editing.value.id}`, payload)
            toast.success('Supplier updated successfully')
        } else {
            await api.post('/master/suppliers', payload)
            toast.success('Supplier created successfully')
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
            toast.error(errors.global)
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
.pagination-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
}
.page-number {
    font-size: 14px;
    color: #666;
}
</style>