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
                        <td class="font-mono">{{ item.debit ? '৳' + item.debit.toLocaleString() : '-' }}</td>
                        <td class="font-mono">{{ item.credit ? '৳' + item.credit.toLocaleString() : '-' }}</td>
                        <td>{{ item.narration }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" title="New Transaction" size="md" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Voucher #</label>
                    <input type="text" class="input-field" :value="form.voucher_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group">
                    <label class="form-label">Voucher Type</label>
                    <select v-model="form.voucher_type" class="select-field">
                        <option value="receipt">Receipt</option>
                        <option value="payment">Payment</option>
                        <option value="journal">Journal</option>
                        <option value="contra">Contra</option>
                        <option value="debit_note">Debit Note</option>
                        <option value="credit_note">Credit Note</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input v-model="form.date" type="date" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Amount *</label>
                    <input v-model.number="form.amount" type="number" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Reference</label>
                    <input v-model="form.reference" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group span-3">
                    <label class="form-label">Debit Account *</label>
                    <select v-model="form.debit_account_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                    </select>
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Credit Account *</label>
                    <select v-model="form.credit_account_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                    </select>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Cheque Number</label>
                    <input v-model="form.cheque_number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Cheque Date</label>
                    <input v-model="form.cheque_date" type="date" class="input-field" />
                </div>
                <div class="form-group span-4">
                    <label class="form-label">Narration</label>
                    <textarea v-model="form.narration" class="input-field" rows="2"></textarea>
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
const accounts = ref([])
const showModal = ref(false)
const saving = ref(false)

const form = reactive({ 
    voucher_type: 'receipt', 
    voucher_number: '',
    date: new Date().toISOString().slice(0, 10), 
    debit_account_id: '', 
    credit_account_id: '', 
    amount: 0, 
    cheque_number: '', 
    cheque_date: '',
    narration: '',
    reference: ''
})

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
    saving.value = true
    try {
        await api.post('/finance/transactions', form)
        window.showToast?.({ type: 'success', message: 'Transaction saved' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' })
    } finally { saving.value = false }
}

onMounted(() => { loadData(); loadAccounts() })
</script>
