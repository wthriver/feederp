<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.formulas') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Formula</button>
        </div>

        <div class="toolbar">
            <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <select v-model="filter.status" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Formula Name</th>
                        <th>Product</th>
                        <th>Protein %</th>
                        <th>Moisture %</th>
                        <th>Status</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.product_name }}</td>
                        <td class="font-mono">{{ item.target_protein }}</td>
                        <td class="font-mono">{{ item.target_moisture }}</td>
                        <td><span :class="['badge', item.status === 'approved' ? 'badge-success' : 'badge-secondary']">{{ item.status }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button v-if="item.status === 'draft'" class="btn btn-sm btn-icon" @click="approve(item)">✅</button>
                            <button class="btn btn-sm btn-icon" @click="optimize(item)">⚡</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'New' }} Formula</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Code *</label>
                            <input v-model="form.code" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Name *</label>
                            <input v-model="form.name" class="input-field" required />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Product *</label>
                        <select v-model="form.product_id" class="select-field">
                            <option value="">Select Product</option>
                            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </select>
                    </div>
                    <div class="form-row form-row-3">
                        <div class="form-group">
                            <label class="form-label">Target Protein %</label>
                            <input v-model.number="form.target_protein" type="number" step="0.1" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Target Moisture %</label>
                            <input v-model.number="form.target_moisture" type="number" step="0.1" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Target Fiber %</label>
                            <input v-model.number="form.target_fiber" type="number" step="0.1" class="input-field" />
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
const products = ref([])
const showModal = ref(false)
const editing = ref(null)
const search = ref('')
const filter = reactive({ status: '' })

const form = reactive({
    code: '', name: '', product_id: '', target_protein: 0, target_moisture: 0, target_fiber: 0, target_fat: 0, target_ash: 0, target_energy: 0
})

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/production/formulas', { params: { search: search.value, status: filter.status } })
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadProducts() {
    try {
        const response = await api.get('/master/products')
        if (response.data.success) products.value = response.data.data
    } catch (error) { console.error(error) }
}

function openModal() {
    editing.value = null
    Object.assign(form, { code: '', name: '', product_id: '', target_protein: 0, target_moisture: 0, target_fiber: 0, target_fat: 0, target_ash: 0, target_energy: 0 })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function approve(item) {
    try {
        await api.post(`/production/formulas/${item.id}/approve`)
        window.showToast?.({ type: 'success', message: 'Formula approved' })
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

async function optimize(item) {
    try {
        const response = await api.get(`/production/formulas/${item.id}/optimize`)
        if (response.data.success) {
            console.log('Optimization:', response.data.data)
            window.showToast?.({ type: 'info', message: `Cost per 1000kg: ₹${response.data.data.total_cost_per_1000kg?.toFixed(2)}` })
        }
    } catch (error) { window.showToast?.({ type: 'error', message: 'Optimization failed' }) }
}

async function save() {
    try {
        if (editing.value) await api.put(`/production/formulas/${editing.value.id}`, form)
        else await api.post('/production/formulas', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(() => { loadData(); loadProducts() })
</script>
