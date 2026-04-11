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

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'Add' }} Vehicle</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Vehicle Number *</label>
                        <input v-model="form.vehicle_number" class="input-field" required />
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <input v-model="form.type" class="input-field" placeholder="Truck, Tempo, Van" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Capacity (tons)</label>
                            <input v-model.number="form.capacity" type="number" class="input-field" />
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
    try {
        await api.post('/transport/vehicles', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(loadData)
</script>
