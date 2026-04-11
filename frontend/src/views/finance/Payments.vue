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
                        <td class="font-mono">₹{{ item.amount?.toLocaleString() }}</td>
                        <td><span class="badge badge-secondary">{{ item.payment_mode }}</span></td>
                        <td><span :class="['badge', item.status === 'completed' ? 'badge-success' : 'badge-warning']">{{ item.status }}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">New Payment</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Party Type</label>
                        <select v-model="form.party_type" class="select-field">
                            <option value="supplier">Supplier</option>
                            <option value="customer">Customer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Party</label>
                        <select v-model="form.party_id" class="select-field">
                            <option value="">Select</option>
                            <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </select>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Amount *</label>
                            <input v-model.number="form.amount" type="number" class="input-field" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input v-model="form.payment_date" type="date" class="input-field" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Payment Mode</label>
                        <select v-model="form.payment_mode" class="select-field">
                            <option value="cash">Cash</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="upi">UPI</option>
                            <option value="neft">NEFT</option>
                            <option value="rtgs">RTGS</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Reference</label>
                        <input v-model="form.reference_number" class="input-field" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const suppliers = ref([])
const customers = ref([])
const showModal = ref(false)

const form = reactive({ party_type: 'supplier', party_id: '', amount: 0, payment_date: new Date().toISOString().slice(0, 10), payment_mode: 'bank', reference_number: '', notes: '' })

const parties = computed(() => form.party_type === 'supplier' ? suppliers.value : customers.value)

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
    } catch (error) { console.error(error) }
}

function openModal() {
    if (suppliers.value.length === 0 && customers.value.length === 0) {
        loadParties()
    }
    showModal.value = true
}

async function save() {
    try {
        await api.post('/finance/payments', form)
        window.showToast?.({ type: 'success', message: 'Payment recorded' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(() => { loadData(); loadParties() })
</script>
