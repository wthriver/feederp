<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.vehicles') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Vehicle</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Vehicle #</th>
                        <th>Type</th>
                        <th>Capacity</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.vehicle_number }}</td>
                        <td>{{ item.type }}</td>
                        <td class="font-mono">{{ item.capacity }} tons</td>
                        <td>{{ item.driver_name || '-' }}</td>
                        <td><span :class="['badge', item.status === 'available' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Vehicle' : 'Add Vehicle'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group span-2">
                    <label class="form-label">Vehicle Number *</label>
                    <input v-model="form.vehicle_number" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <input v-model="form.type" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Capacity (tons)</label>
                    <input v-model.number="form.capacity" type="number" class="input-field" />
                </div>
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

const form = reactive({ vehicle_number: '', type: '', capacity: 0, owner_name: '', driver_id: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/transport/vehicles')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { vehicle_number: '', type: '', capacity: 0, owner_name: '', driver_id: '' })
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
        if (editing.value) await api.put(`/transport/vehicles/${editing.value.id}`, form)
        else await api.post('/transport/vehicles', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

onMounted(loadData)
</script>
