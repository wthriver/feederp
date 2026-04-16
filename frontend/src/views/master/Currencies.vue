<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Currencies</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No currencies found.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Symbol</th>
                        <th>Exchange Rate</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.currency_code }}</td>
                        <td>{{ item.currency_name }}</td>
                        <td>{{ item.symbol }}</td>
                        <td class="font-mono">{{ item.exchange_rate }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Currency' : 'Add Currency'" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Code *</label>
                    <input v-model="form.currency_code" class="input-field" placeholder="USD" />
                </div>
                <div class="form-group">
                    <label class="form-label">Symbol *</label>
                    <input v-model="form.symbol" class="input-field" placeholder="$" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Name *</label>
                    <input v-model="form.currency_name" class="input-field" />
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Exchange Rate (to INR) *</label>
                <input v-model="form.exchange_rate" type="number" class="input-field" />
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
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

const form = reactive({ currency_code: '', symbol: '', currency_name: '', exchange_rate: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/master/currencies')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    editing.value = null
    Object.assign(form, { currency_code: '', symbol: '', currency_name: '', exchange_rate: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    if (!form.currency_code || !form.currency_name || !form.exchange_rate) {
        window.showToast?.({ type: 'error', message: 'All fields are required' })
        return
    }
    saving.value = true
    try {
        await api.post('/master/currencies', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed' })
    } finally {
        saving.value = false
    }
}

onMounted(loadData)
</script>