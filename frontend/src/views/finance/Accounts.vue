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
                        <td class="font-mono" :class="{ 'text-danger': item.current_balance < 0 }">₹{{ item.current_balance?.toLocaleString() }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">Add Account</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">{{ $t('common.code') }} *</label>
                        <input v-model="form.code" class="input-field" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">{{ $t('common.name') }} *</label>
                        <input v-model="form.name" class="input-field" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Type</label>
                        <select v-model="form.type" class="select-field">
                            <option value="customer">Customer</option>
                            <option value="supplier">Supplier</option>
                            <option value="bank">Bank</option>
                            <option value="cash">Cash</option>
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
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

const form = reactive({ code: '', name: '', type: 'customer', opening_balance: 0 })

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
    try {
        await api.post('/finance/accounts', form)
        window.showToast?.({ type: 'success', message: 'Account created' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(loadData)
</script>
