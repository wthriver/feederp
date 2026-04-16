<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.rawMaterials') }}</h1>
            <button class="btn btn-primary" @click="showModal = true">+ {{ $t('common.add') }}</button>
        </div>

        <div class="toolbar">
            <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.category" class="select-field" @change="loadData">
                <option value="">All Categories</option>
                <option value="grain">Grain</option>
                <option value="protein">Protein</option>
                <option value="mineral">Mineral</option>
                <option value="vitamin">Vitamin</option>
                <option value="additive">Additive</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Min Stock</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.category }}</td>
                        <td>{{ item.unit_name }}</td>
                        <td class="font-mono">{{ item.min_stock }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="edit(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="meta.page--; loadData()">◄</button>
                <span>Page {{ meta.page }} of {{ meta.totalPages }}</span>
                <button class="pagination-btn" :disabled="meta.page >= meta.totalPages" @click="meta.page++; loadData()">►</button>
            </div>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Raw Material' : 'Add Raw Material'" size="lg" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" required />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select v-model="form.category" class="select-field">
                        <option value="grain">Grain</option>
                        <option value="protein">Protein</option>
                        <option value="mineral">Mineral</option>
                        <option value="vitamin">Vitamin</option>
                        <option value="additive">Additive</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <select v-model="form.unit_id" class="select-field">
                        <option v-for="u in units" :key="u.id" :value="u.id">{{ u.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Opening Stock</label>
                    <input v-model.number="form.opening_stock" type="number" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Opening Rate</label>
                    <input v-model.number="form.opening_rate" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Min Stock</label>
                    <input v-model.number="form.min_stock" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Max Stock</label>
                    <input v-model.number="form.max_stock" type="number" class="input-field" />
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
const filter = reactive({ category: '' })
const meta = reactive({ page: 1, limit: 50, total: 0, totalPages: 0 })

const form = reactive({
    code: '', name: '', category: 'grain', unit_id: '', min_stock: 0, max_stock: null, opening_stock: 0, opening_rate: 0
})

function debounceLoad() {
    setTimeout(loadData, 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/raw-materials', {
            params: { search: search.value, category: filter.category, page: meta.page, limit: meta.limit }
        })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function loadUnits() {
    try {
        const response = await api.get('/master/units')
        if (response.data.success) {
            units.value = response.data.data
            if (units.value.length) form.unit_id = units.value[0].id
        }
    } catch (error) {
        console.error(error)
    }
}

function edit(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/master/raw-materials/${editing.value.id}`, form)
            window.showToast?.({ type: 'success', message: 'Updated successfully' })
        } else {
            await api.post('/master/raw-materials', form)
            window.showToast?.({ type: 'success', message: 'Created successfully' })
        }
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Operation failed' })
    } finally {
        saving.value = false
    }
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Raw Material',
        message: `Are you sure you want to delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/raw-materials/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

onMounted(() => {
    loadData()
    loadUnits()
})
</script>
