<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.qcParameters') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Parameter</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Min Value</th>
                        <th>Max Value</th>
                        <th>Unit</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-secondary">{{ item.type }}</span></td>
                        <td class="font-mono">{{ item.min_value }}</td>
                        <td class="font-mono">{{ item.max_value }}</td>
                        <td>{{ item.unit }}</td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit QC Parameter' : 'Add QC Parameter'" size="md" :loading="saving">
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
                    <select v-model="form.type" class="select-field">
                        <option value="raw_material">Raw Material</option>
                        <option value="finished_product">Finished Product</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <input v-model="form.unit" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Min</label>
                    <input v-model.number="form.min_value" type="number" step="0.01" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Max</label>
                    <input v-model.number="form.max_value" type="number" step="0.01" class="input-field" />
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
const data = ref([])
const showModal = ref(false)
const saving = ref(false)
const editing = ref(null)

const form = reactive({ code: '', name: '', type: 'finished_product', min_value: 0, max_value: 100, target_value: 0, unit: '%' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/quality/parameters')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', type: 'finished_product', min_value: 0, max_value: 100, target_value: 0, unit: '%' })
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
        await api.post('/quality/parameters', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

onMounted(loadData)
</script>
