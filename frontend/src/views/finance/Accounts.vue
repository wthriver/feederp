<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.accounts') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Account</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('common.code') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Type</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td><span class="badge badge-secondary">{{ item.type }}</span></td>
                        <td class="font-mono" :class="{ 'text-danger': item.current_balance < 0 }">৳{{ item.current_balance?.toLocaleString() }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Account' : 'Add Account'" size="md" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">{{ $t('common.code') }} *</label>
                    <input v-model="form.code" class="input-field" required placeholder="e.g., AC-001" />
                </div>
                <div class="form-group span-3">
                    <label class="form-label">{{ $t('common.name') }} *</label>
                    <input v-model="form.name" class="input-field" required placeholder="Account name" />
                </div>
            </div>
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select v-model="form.type" class="select-field">
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                        <option value="bank">Bank</option>
                        <option value="cash">Cash</option>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="asset">Asset</option>
                        <option value="liability">Liability</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Opening Balance</label>
                    <input v-model.number="form.opening_balance" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Contact Person</label>
                    <input v-model="form.contact_person" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input v-model="form.phone" class="input-field" />
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Email</label>
                <input v-model="form.email" type="email" class="input-field" />
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Address</label>
                <textarea v-model="form.address" class="input-field" rows="2"></textarea>
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
const editing = ref(false)
const saving = ref(false)

const form = reactive({ 
    code: '', name: '', type: 'customer', opening_balance: 0,
    contact_person: '', phone: '', email: '', address: '', notes: '' 
})

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/finance/accounts')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() { showModal.value = true }

async function save() {
    saving.value = true
    try {
        await api.post('/finance/accounts', form)
        window.showToast?.({ type: 'success', message: 'Account created' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' })
    } finally { saving.value = false }
}

onMounted(loadData)
</script>
