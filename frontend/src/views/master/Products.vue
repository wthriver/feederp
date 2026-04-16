<template>
    <div class="data-page">
        <div class="page-header">
            <div class="page-header-left">
                <h1>{{ $t('nav.products') }}</h1>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" @click="openModal()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Product
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
                    <option value="cattle">Cattle Feed</option>
                    <option value="poultry">Poultry Feed</option>
                    <option value="fish">Fish Feed</option>
                    <option value="other">Other</option>
                </select>
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

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Pack Size</th>
                        <th class="num">MRP</th>
                        <th>Status</th>
                        <th style="width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id" @click="editItem(item)" style="cursor: pointer;">
                        <td class="mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-info">{{ item.type }}</span></td>
                        <td>{{ item.pack_size }} {{ item.unit_name }}</td>
                        <td class="num">৳{{ formatNumber(item.mrp) }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
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
                        <td colspan="7" class="text-center text-muted" style="padding: 40px;">
                            No products found
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Showing {{ data.length }} of {{ meta.total }} products</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="meta.page--; loadData()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <span class="page-info">Page {{ meta.page }}</span>
                <button class="pagination-btn" @click="meta.page++; loadData()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Product' : 'Add Product'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" required placeholder="PRD-001" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" required placeholder="Product name" />
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select v-model="form.type" class="select-field">
                        <option value="cattle">Cattle</option>
                        <option value="poultry">Poultry</option>
                        <option value="fish">Fish</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <input v-model="form.category" class="input-field" placeholder="Starter..." />
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <select v-model="form.unit_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Pack Size</label>
                    <input v-model="form.pack_size" type="number" class="input-field" placeholder="50" />
                </div>
            </div>

            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">MRP</label>
                    <input v-model="form.mrp" type="number" class="input-field" placeholder="0.00" />
                </div>
                <div class="form-group">
                    <label class="form-label">Min Stock</label>
                    <input v-model.number="form.min_stock" type="number" class="input-field" placeholder="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">Reorder Level</label>
                    <input v-model.number="form.reorder_level" type="number" class="input-field" placeholder="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">GST Rate (%)</label>
                    <input v-model.number="form.gst_rate" type="number" class="input-field" placeholder="18" />
                </div>
                <div class="form-group">
                    <label class="form-label">HSN Code</label>
                    <input v-model="form.hsn_code" class="input-field" placeholder="1234" />
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
                <div class="form-group span-3">
                    <label class="form-label">Description</label>
                    <input v-model="form.description" class="input-field" placeholder="Product description" />
                </div>
            </div>

            <template #footer>
                <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="save">{{ $t('common.save') }}</button>
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
const units = ref([])
const showModal = ref(false)
const editing = ref(null)
const search = ref('')
const filter = reactive({ type: '', is_active: '' })
const meta = reactive({ page: 1, total: 0 })

const form = reactive({
    code: '', name: '', type: 'cattle', category: '', description: '',
    pack_size: 50, unit_id: '', mrp: 0, min_stock: 0, reorder_level: 0,
    hsn_code: '', gst_rate: 0, sku: '', is_active: true
})

async function loadUnits() {
    try {
        const response = await api.get('/master/units')
        if (response.data.success) units.value = response.data.data
    } catch (error) { console.error(error) }
}

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/products', { params: { search: search.value, type: filter.type, is_active: filter.is_active } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, {
        code: '', name: '', type: 'cattle', category: '', description: '',
        pack_size: 50, unit_id: '', mrp: 0, min_stock: 0, reorder_level: 0,
        hsn_code: '', gst_rate: 0, sku: '', is_active: true
    })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, {
        ...item,
        is_active: item.is_active === 1 || item.is_active === true
    })
    showModal.value = true
}

async function save() {
    saving.value = true
    try {
        if (editing.value) await api.put(`/master/products/${editing.value.id}`, form)
        else await api.post('/master/products', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Save failed' })
    } finally {
        saving.value = false
    }
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Product',
        message: `Are you sure you want to delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/products/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

function formatNumber(num) {
    if (num === null || num === undefined) return '-'
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

onMounted(() => { loadData(); loadUnits() })
</script>
