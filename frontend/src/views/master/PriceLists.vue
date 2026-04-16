<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.priceLists') || 'Price Lists' }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ {{ $t('common.add') }}</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Effective From</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.price_type || '-' }}</td>
                        <td>{{ item.effective_from || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Price List' : 'Add Price List'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Code *</label>
                    <input v-model="form.code" class="input-field" />
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Name *</label>
                    <input v-model="form.name" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select v-model="form.price_type" class="select-field">
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="special">Special</option>
                    </select>
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Effective From</label>
                    <input v-model="form.effective_from" type="date" class="input-field" />
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
const showModal = ref(false)
const editing = ref(null)

const form = reactive({ code: '', name: '', price_type: 'retail', effective_from: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/price-lists')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', price_type: 'retail', effective_from: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/master/price-lists/${editing.value.id}`, form)
        } else {
            await api.post('/master/price-lists', form)
        }
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
        title: 'Delete Price List',
        message: `Delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/price-lists/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>