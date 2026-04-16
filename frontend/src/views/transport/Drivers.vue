<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.drivers') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Driver</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.name') }}</th>
                        <th>Phone</th>
                        <th>License Number</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td>{{ item.name }}</td>
                        <td>{{ item.phone }}</td>
                        <td class="font-mono">{{ item.license_number }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Driver' : 'Add Driver'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group span-2">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input v-model="form.phone" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">License #</label>
                    <input v-model="form.license_number" class="input-field" />
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Address</label>
                <textarea v-model="form.address" class="input-field" rows="2"></textarea>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="save">Save</button>
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

const form = reactive({ name: '', phone: '', license_number: '', address: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/transport/drivers')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { name: '', phone: '', license_number: '', address: '' })
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
        if (editing.value) await api.put(`/transport/drivers/${editing.value.id}`, form)
        else await api.post('/transport/drivers', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

onMounted(loadData)
</script>
