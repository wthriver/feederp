<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Regions</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No regions found.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Timezone</th>
                        <th>Default Currency</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.timezone || '-' }}</td>
                        <td>{{ item.currency || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'Add' }} Region</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Code *</label>
                            <input v-model="form.code" class="input-field" placeholder="NORTH" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Name *</label>
                            <input v-model="form.name" class="input-field" placeholder="North Region" />
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Timezone</label>
                            <input v-model="form.timezone" class="input-field" placeholder="Asia/Kolkata" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Currency</label>
                            <input v-model="form.currency" class="input-field" placeholder="INR" />
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
const editing = ref(null)

const form = reactive({ code: '', name: '', timezone: '', currency: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/regions')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', timezone: '', currency: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    if (!form.code || !form.name) {
        window.showToast?.({ type: 'error', message: 'Code and name required' })
        return
    }
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/master/regions/${editing.value.id}`, form)
            window.showToast?.({ type: 'success', message: 'Updated' })
        } else {
            await api.post('/master/regions', form)
            window.showToast?.({ type: 'success', message: 'Created' })
        }
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
        title: 'Delete Region',
        message: `Delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/regions/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>