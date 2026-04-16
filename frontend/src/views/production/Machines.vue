<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.machines') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Machine</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Brand</th>
                        <th>Capacity</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.type }}</td>
                        <td>{{ item.brand }}</td>
                        <td class="font-mono">{{ item.capacity }} {{ item.unit }}</td>
                        <td><span :class="['badge', item.status === 'available' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Machine' : 'Add Machine'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" required />
                </div>
                <div class="form-group span-3">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" required />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <input v-model="form.type" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Brand</label>
                    <input v-model="form.brand" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Capacity</label>
                    <input v-model.number="form.capacity" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <input v-model="form.unit" class="input-field" />
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

const form = reactive({ code: '', name: '', type: '', brand: '', model: '', capacity: 0, unit: 'tons/hr' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/production/machines')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', type: '', brand: '', model: '', capacity: 0, unit: 'tons/hr' })
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
        await api.post('/production/machines', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

onMounted(loadData)
</script>
