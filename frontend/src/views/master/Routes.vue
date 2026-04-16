<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.routes') || 'Routes' }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ {{ $t('common.add') }}</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No routes found. Add your first route.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.name') }}</th>
                        <th>Name (Bengali)</th>
                        <th>{{ $t('common.description') }}</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td>{{ item.name }}</td>
                        <td>{{ item.name_bn || '-' }}</td>
                        <td>{{ item.description || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="deleteItem(item)">🗑️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Route' : 'Add Route'" size="md" :loading="saving">
            <div class="form-group">
                <label class="form-label">Name *</label>
                <input v-model="form.name" class="input-field" placeholder="Route name" />
            </div>
            <div class="form-group">
                <label class="form-label">Name (Bengali)</label>
                <input v-model="form.name_bn" class="input-field" placeholder="রুট নাম" />
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea v-model="form.description" class="input-field" rows="2"></textarea>
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

const form = reactive({ name: '', name_bn: '', description: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/routes')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { name: '', name_bn: '', description: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    if (!form.name) {
        window.showToast?.({ type: 'error', message: 'Name is required' })
        return
    }
    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/master/routes/${editing.value.id}`, form)
            window.showToast?.({ type: 'success', message: 'Updated successfully' })
        } else {
            await api.post('/master/routes', form)
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
        title: 'Delete Route',
        message: `Delete "${item.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`/master/routes/${item.id}`)
            window.showToast?.({ type: 'success', message: 'Deleted successfully' })
            loadData()
        }
    })
}

onMounted(loadData)
</script>