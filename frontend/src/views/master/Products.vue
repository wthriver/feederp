<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.products') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ {{ $t('common.add') }}</button>
        </div>

        <div class="toolbar">
            <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.type" class="select-field" @change="loadData">
                <option value="">All Types</option>
                <option value="cattle">Cattle Feed</option>
                <option value="poultry">Poultry Feed</option>
                <option value="fish">Fish Feed</option>
                <option value="other">Other</option>
            </select>
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
                        <th>MRP</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-info">{{ item.type }}</span></td>
                        <td class="font-mono">{{ item.pack_size }} {{ item.unit_name }}</td>
                        <td class="font-mono">₹{{ item.mrp }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
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
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'Add' }} Product</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">{{ $t('common.code') }} *</label>
                            <input v-model="form.code" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ $t('common.name') }} *</label>
                            <input v-model="form.name" class="input-field" required />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Type *</label>
                            <select v-model="form.type" class="select-field">
                                <option value="cattle">Cattle Feed</option>
                                <option value="poultry">Poultry Feed</option>
                                <option value="fish">Fish Feed</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <input v-model="form.category" class="input-field" />
                        </div>
                    </div>
                    <div class="form-row form-row-3">
                        <div class="form-group">
                            <label class="form-label">Pack Size</label>
                            <input v-model.number="form.pack_size" type="number" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">MRP</label>
                            <input v-model.number="form.mrp" type="number" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Min Stock</label>
                            <input v-model.number="form.min_stock" type="number" class="input-field" />
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
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
const showModal = ref(false)
const editing = ref(null)
const search = ref('')
const filter = reactive({ type: '' })
const meta = reactive({ page: 1, total: 0 })

const form = reactive({
    code: '', name: '', type: 'cattle', category: '', pack_size: 50, mrp: 0, min_stock: 0
})

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/products', { params: { search: search.value, type: filter.type } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', type: 'cattle', category: '', pack_size: 50, mrp: 0, min_stock: 0 })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    try {
        if (editing.value) await api.put(`/master/products/${editing.value.id}`, form)
        else await api.post('/master/products', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Save failed' })
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

onMounted(loadData)
</script>
