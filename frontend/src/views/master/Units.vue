<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.units') || 'Units' }}</h1>
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
                        <th>Type</th>
                        <th>Symbol</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.type || '-' }}</td>
                        <td>{{ item.symbol }}</td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Unit' : 'Add Unit'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Code *</label>
                    <input v-model="form.code" class="input-field" placeholder="e.g., KG" />
                </div>
                <div class="form-group">
                    <label class="form-label">Symbol *</label>
                    <input v-model="form.symbol" class="input-field" placeholder="e.g., kg" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Name *</label>
                    <input v-model="form.name" class="input-field" placeholder="e.g., Kilogram" />
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Type</label>
                <select v-model="form.type" class="select-field">
                    <option value="">Select</option>
                    <option value="weight">Weight</option>
                    <option value="volume">Volume</option>
                    <option value="quantity">Quantity</option>
                    <option value="length">Length</option>
                </select>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
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
const showModal = ref(false)
const editing = ref(null)
const search = ref('')

const form = reactive({ code: '', name: '', symbol: '', type: '' })

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/units', { params: { search: search.value } })
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', symbol: '', type: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    if (!form.code || !form.name || !form.symbol) {
        window.showToast?.({ type: 'error', message: 'Please fill required fields' })
        return
    }
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/master/units/${editing.value.id}`, form)
            window.showToast?.({ type: 'success', message: 'Updated successfully' })
        } else {
            await api.post('/master/units', form)
            window.showToast?.({ type: 'success', message: 'Created successfully' })
        }
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
        title: 'Delete Unit',
        message: `Delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/units/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>