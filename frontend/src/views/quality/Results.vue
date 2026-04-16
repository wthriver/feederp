<template>
    <div class="data-page">
        <div class="page-header">
            <h1>QC Results</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Test Result</button>
        </div>

        <div class="toolbar">
            <input v-model="filter.reference_id" type="text" placeholder="Batch/Lot Number" class="input-field" @input="debounceLoad" />
            <select v-model="filter.reference_type" class="select-field" @change="loadData">
                <option value="">All Types</option>
                <option value="inward_item">Raw Material</option>
                <option value="batch">Production Batch</option>
            </select>
            <select v-model="filter.is_pass" class="select-field" @change="loadData">
                <option value="">All Results</option>
                <option value="1">Passed</option>
                <option value="0">Failed</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Test Date</th>
                        <th>Reference</th>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Result</th>
                        <th>Tested By</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td>{{ item.tested_at }}</td>
                        <td class="font-mono">{{ item.reference_number }}</td>
                        <td>{{ item.parameter_name }}</td>
                        <td class="font-mono">{{ item.value }} {{ item.unit }}</td>
                        <td class="font-mono">{{ item.min_value || '-' }}</td>
                        <td class="font-mono">{{ item.max_value || '-' }}</td>
                        <td><span :class="['badge', item.is_pass ? 'badge-success' : 'badge-danger']">{{ item.is_pass ? 'PASS' : 'FAIL' }}</span></td>
                        <td>{{ item.tested_by_name }}</td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="view(item)">👁️</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="9" class="text-center text-muted">No results found</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
            <div class="pagination-controls">
                <button class="pagination-btn" :disabled="meta.page <= 1" @click="meta.page--; loadData()">◄</button>
                <span>Page {{ meta.page }}</span>
                <button class="pagination-btn" :disabled="meta.page >= meta.totalPages" @click="meta.page++; loadData()">►</button>
            </div>
        </div>

        <AppModal v-model="showModal" title="New QC Test Result" size="md" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Test Type</label>
                    <select v-model="form.reference_type" class="select-field" @change="loadReferenceOptions">
                        <option value="inward_item">Raw Material</option>
                        <option value="batch">Production Batch</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Reference *</label>
                    <select v-model="form.reference_id" class="select-field" required>
                        <option value="">Select</option>
                        <option v-for="r in referenceOptions" :key="r.id" :value="r.id">{{ r.number || r.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Parameter *</label>
                    <select v-model="form.parameter_id" class="select-field" required>
                        <option value="">Select</option>
                        <option v-for="p in parameters" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Test Date</label>
                    <input v-model="form.tested_at" type="datetime-local" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Value *</label>
                    <input v-model.number="form.value" type="number" class="input-field" step="0.01" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Min</label>
                    <input v-model.number="form.min_value" type="number" class="input-field" step="0.01" />
                </div>
                <div class="form-group">
                    <label class="form-label">Max</label>
                    <input v-model.number="form.max_value" type="number" class="input-field" step="0.01" />
                </div>
                <div class="form-group">
                    <label class="form-label">Result</label>
                    <div class="result-preview" :class="{ pass: isPass, fail: !isPass }" style="margin: 0; padding: 6px 12px;">
                        {{ isPass ? 'PASS' : 'FAIL' }}
                    </div>
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Remarks</label>
                <textarea v-model="form.remarks" class="input-field" rows="2"></textarea>
            </div>
            <template #footer>
                <button class="btn" @click="closeModal">{{ $t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="save">{{ $t('common.save') }}</button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const data = ref([])
const parameters = ref([])
const referenceOptions = ref([])
const showModal = ref(false)
const saving = ref(false)
const filter = reactive({ reference_id: '', reference_type: '', is_pass: '' })
const meta = reactive({ page: 1, total: 0, totalPages: 0 })

const form = reactive({
    reference_type: 'inward_item', reference_id: '', parameter_id: '',
    value: 0, min_value: null, max_value: null, tested_at: new Date().toISOString().slice(0, 16), remarks: ''
})

const isPass = computed(() => {
    const v = form.value
    const min = form.min_value
    const max = form.max_value
    if (min !== null && v < min) return false
    if (max !== null && v > max) return false
    return true
})

function debounceLoad() { setTimeout(loadData, 300) }

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/quality/results', { params: { ...filter, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta)
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadParameters() {
    try {
        const response = await api.get('/quality/parameters')
        if (response.data.success) parameters.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadReferenceOptions() {
    form.reference_id = ''
    try {
        if (form.reference_type === 'inward_item') {
            const response = await api.get('/purchase/goods-inward')
            if (response.data.success) {
                referenceOptions.value = response.data.data.map(g => ({ id: g.id, number: g.grn_number }))
            }
        } else {
            const response = await api.get('/production/batches')
            if (response.data.success) {
                referenceOptions.value = response.data.data.map(b => ({ id: b.id, number: b.batch_number }))
            }
        }
    } catch (error) { console.error(error) }
}

function openModal() {
    Object.assign(form, { reference_type: 'inward_item', reference_id: '', parameter_id: '', value: 0, min_value: null, max_value: null, tested_at: new Date().toISOString().slice(0, 16), remarks: '' })
    showModal.value = true
    loadReferenceOptions()
}

async function view(item) { console.log(item) }

async function save() {
    if (!form.reference_id || !form.parameter_id || form.value === null) {
        window.showToast?.({ type: 'error', message: 'Please fill required fields' })
        return
    }
    saving.value = true
    try {
        await api.post('/quality/results', { ...form, is_pass: isPass.value ? 1 : 0 })
        window.showToast?.({ type: 'success', message: 'Result saved' })
        closeModal()
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
    finally { saving.value = false }
}

function closeModal() { showModal.value = false }

onMounted(() => { loadData(); loadParameters(); loadReferenceOptions() })
</script>

<style scoped>
.result-preview { padding: 12px; text-align: center; font-size: 18px; font-weight: bold; border-radius: 4px; margin: 12px 0; }
.result-preview.pass { background: var(--success-bg); color: var(--success); }
.result-preview.fail { background: var(--danger-bg); color: var(--danger); }
</style>
