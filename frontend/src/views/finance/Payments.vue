<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.payments') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ New Payment</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Payment #</th>
                        <th>Date</th>
                        <th>Party</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.payment_number }}</td>
                        <td>{{ item.payment_date }}</td>
                        <td>{{ item.party_name }}</td>
                        <td class="font-mono">৳{{ item.amount?.toLocaleString() }}</td>
                        <td><span class="badge badge-secondary">{{ item.payment_mode }}</span></td>
                        <td><span :class="['badge', item.status === 'completed' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" title="New Payment" size="md" :loading="saving">
            <div class="form-row-4">
                <div class="form-group">
                    <label class="form-label">Payment #</label>
                    <input type="text" class="input-field" :value="form.payment_number" disabled placeholder="Auto" />
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input v-model="form.payment_date" type="date" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Type</label>
                    <select v-model="form.payment_type" class="select-field">
                        <option value="outgoing">Outgoing</option>
                        <option value="incoming">Incoming</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Party Type</label>
                    <select v-model="form.party_type" class="select-field">
                        <option value="supplier">Supplier</option>
                        <option value="customer">Customer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Mode</label>
                    <select v-model="form.payment_mode" class="select-field">
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="cheque">Cheque</option>
                        <option value="upi">UPI</option>
                    </select>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group span-3">
                    <label class="form-label">Party *</label>
                    <select v-model="form.party_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount *</label>
                    <input v-model.number="form.amount" type="number" class="input-field" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Reference #</label>
                    <input v-model="form.reference_number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Reference Date</label>
                    <input v-model="form.reference_date" type="date" class="input-field" />
                </div>
            </div>
            <div v-if="selectedParty" class="info-grid" style="margin-top: 6px;">
                <div class="info-item">
                    <span class="info-label">Contact</span>
                    <span class="info-value">{{ selectedParty.phone || '-' }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Balance</span>
                    <span class="info-value">৳{{ (selectedParty.balance || 0).toLocaleString() }}</span>
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group span-4">
                    <label class="form-label">Notes</label>
                    <input v-model="form.notes" class="input-field" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const data = ref([])
const suppliers = ref([])
const customers = ref([])
const bankAccounts = ref([])
const showModal = ref(false)
const saving = ref(false)

const form = reactive({ 
    party_type: 'supplier', 
    party_id: '', 
    amount: 0, 
    payment_date: new Date().toISOString().slice(0, 10), 
    payment_type: 'outgoing',
    payment_number: '',
    payment_mode: 'bank', 
    bank_account_id: '',
    reference_number: '', 
    reference_date: '',
    invoice_reference: '',
    notes: '' 
})

const parties = computed(() => form.party_type === 'supplier' ? suppliers.value : customers.value)

const selectedParty = computed(() => {
    return parties.value.find(p => p.id === form.party_id)
})

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/finance/payments')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadParties() {
    try {
        const supRes = await api.get('/master/suppliers')
        if (supRes.data.success) suppliers.value = supRes.data.data
        const custRes = await api.get('/sales/customers')
        if (custRes.data.success) customers.value = custRes.data.data
        const bankRes = await api.get('/finance/accounts', { params: { type: 'bank' } })
        if (bankRes.data.success) bankAccounts.value = bankRes.data.data
    } catch (error) { console.error(error) }
}

function openModal() {
    Object.assign(form, {
        party_type: 'supplier', party_id: '', amount: 0,
        payment_date: new Date().toISOString().slice(0, 10), payment_type: 'outgoing',
        payment_number: '', payment_mode: 'bank', bank_account_id: '',
        reference_number: '', reference_date: '', invoice_reference: '', notes: ''
    })
    if (suppliers.value.length === 0 && customers.value.length === 0) {
        loadParties()
    }
    showModal.value = true
}

async function save() {
    saving.value = true
    try {
        await api.post('/finance/payments', form)
        window.showToast?.({ type: 'success', message: 'Payment recorded' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' })
    } finally { saving.value = false }
}

onMounted(() => { loadData(); loadParties() })
</script>
