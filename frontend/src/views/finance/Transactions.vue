<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.transactions') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Transaction</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Voucher #</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Account</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Narration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.voucher_number }}</td>
                        <td>{{ item.date }}</td>
                        <td><span class="badge badge-secondary">{{ item.voucher_type }}</span></td>
                        <td>{{ item.account_name }}</td>
                        <td class="font-mono">{{ item.debit ? '₹' + item.debit.toLocaleString() : '-' }}</td>
                        <td class="font-mono">{{ item.credit ? '₹' + item.credit.toLocaleString() : '-' }}</td>
                        <td>{{ item.narration }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">New Transaction</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Voucher Type</label>
                        <select v-model="form.voucher_type" class="select-field">
                            <option value="receipt">Receipt</option>
                            <option value="payment">Payment</option>
                            <option value="journal">Journal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input v-model="form.date" type="date" class="input-field" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Account</label>
                        <select v-model="form.account_id" class="select-field">
                            <option value="">Select</option>
                            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                        </select>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Debit</label>
                            <input v-model.number="form.debit" type="number" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Credit</label>
                            <input v-model.number="form.credit" type="number" class="input-field" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Narration</label>
                        <textarea v-model="form.narration" class="input-field" rows="2"></textarea>
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
const accounts = ref([])
const showModal = ref(false)

const form = reactive({ voucher_type: 'receipt', date: new Date().toISOString().slice(0, 10), account_id: '', opposite_account_id: '', debit: 0, credit: 0, narration: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/finance/transactions')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadAccounts() {
    try {
        const response = await api.get('/finance/accounts')
        if (response.data.success) accounts.value = response.data.data
    } catch (error) { console.error(error) }
}

function openModal() { showModal.value = true }

async function save() {
    try {
        await api.post('/finance/transactions', form)
        window.showToast?.({ type: 'success', message: 'Transaction saved' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(() => { loadData(); loadAccounts() })
</script>
