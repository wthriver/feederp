<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.stock') }}</h1>
            <div class="flex gap-2">
                <button class="btn" @click="showTransferModal = true">+ Transfer</button>
                <button class="btn btn-primary" @click="showAdjustModal = true">+ Adjustment</button>
            </div>
        </div>

        <div class="toolbar">
            <select v-model="filter.type" class="select-field" @change="loadData">
                <option value="">All Types</option>
                <option value="raw_material">Raw Materials</option>
                <option value="product">Products</option>
            </select>
            <select v-model="filter.godown_id" class="select-field" @change="loadData">
                <option value="">All Godowns</option>
                <option v-for="g in godowns" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <input v-model="filter.search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceLoad" />
            <button class="btn btn-sm" @click="loadData">&#8635;</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Type</th>
                        <th>Godown</th>
                        <th>Quantity</th>
                        <th>Rate</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="`${item.item_type}-${item.item_id}-${item.godown_id}`">
                        <td class="font-mono">{{ item.item_code }}</td>
                        <td>{{ item.item_name }}</td>
                        <td><span class="badge badge-secondary">{{ item.item_type === 'raw_material' ? 'Raw Material' : 'Product' }}</span></td>
                        <td>{{ item.godown_name }}</td>
                        <td class="font-mono text-right">{{ formatNumber(item.total_qty) }}</td>
                        <td class="font-mono text-right">₹{{ formatNumber(item.avg_rate) }}</td>
                        <td class="font-mono text-right">₹{{ formatNumber(item.total_qty * item.avg_rate) }}</td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td colspan="7" class="text-center text-muted">No stock data available</td>
                    </tr>
                </tbody>
                <tfoot v-if="data.length > 0">
                    <tr style="font-weight: 600; background: var(--bg-header);">
                        <td colspan="4" class="text-right">Total:</td>
                        <td class="font-mono text-right">{{ formatNumber(totals.qty) }}</td>
                        <td></td>
                        <td class="font-mono text-right">₹{{ formatNumber(totals.value) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }} items</div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const godowns = ref([])
const filter = reactive({ type: '', godown_id: '', search: '' })
const meta = reactive({ page: 1, total: 0 })

const totals = computed(() => {
    return data.value.reduce((acc, item) => ({
        qty: acc.qty + (item.total_qty || 0),
        value: acc.value + ((item.total_qty || 0) * (item.avg_rate || 0))
    }), { qty: 0, value: 0 })
})

function formatNumber(num) {
    return num?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'
}

function debounceLoad() {
    setTimeout(loadData, 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/inventory/stock', {
            params: { type: filter.type, godown_id: filter.godown_id, search: filter.search }
        })
        if (response.data.success) {
            data.value = response.data.data
            meta.total = response.data.meta?.total || data.value.length
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

async function loadGodowns() {
    try {
        const response = await api.get('/master/godowns')
        if (response.data.success) {
            godowns.value = response.data.data
        }
    } catch (error) {
        console.error(error)
    }
}

onMounted(() => {
    loadData()
    loadGodowns()
})
</script>

<style scoped>
.tfoot {
    font-weight: bold;
    background: var(--bg-header);
}
</style>
