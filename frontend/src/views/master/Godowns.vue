<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.godowns') }}</h1>
            <button class="btn btn-primary" @click="openModal()" aria-label="Add new godown">+ {{ $t('common.add') }}</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-secondary">{{ item.type?.replace('_', ' ') }}</span></td>
                        <td>{{ item.location }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)" aria-label="Edit godown">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)" aria-label="Delete godown">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false" role="dialog" aria-modal="true" aria-labelledby="godown-modal-title">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 id="godown-modal-title" class="modal-title">{{ editing ? 'Edit' : 'Add' }} Godown</h3>
                    <button class="modal-close" @click="showModal = false" aria-label="Close modal">&times;</button>
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
                            <select v-model="form.type" class="select-field" required>
                                <option value="raw_material">Raw Material</option>
                                <option value="finished_goods">Finished Goods</option>
                                <option value="semi_finished">Semi Finished</option>
                                <option value="general">General</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Location</label>
                            <input v-model="form.location" class="input-field" />
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false" aria-label="Cancel">{{ $t('common.cancel') }}</button>
                    <button class="btn btn-primary" @click="save" aria-label="Save godown">{{ $t('common.save') }}</button>
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

const form = reactive({ code: '', name: '', type: 'raw_material', location: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', type: 'raw_material', location: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    try {
        if (editing.value) await api.put(`/master/godowns/${editing.value.id}`, form)
        else await api.post('/master/godowns', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Save failed' })
    }
}

async function deleteItem(item) {
    window.showConfirm?.({
        title: 'Delete Godown',
        message: `Are you sure you want to delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/godowns/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>
