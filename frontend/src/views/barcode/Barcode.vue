<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.barcode') }}</h1>
        </div>

        <div class="barcode-section">
            <div class="card">
                <h3>Generate Barcode</h3>
                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label class="form-label">Item Type</label>
                        <select v-model="generateForm.item_type" class="select-field">
                            <option value="raw_material">Raw Material</option>
                            <option value="product">Product</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Item</label>
                        <select v-model="generateForm.item_id" class="select-field">
                            <option value="">Select</option>
                            <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
                        </select>
                    </div>
                </div>
                <div class="form-row form-row-3">
                    <div class="form-group">
                        <label class="form-label">Batch Number</label>
                        <input v-model="generateForm.batch_number" class="input-field" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Quantity</label>
                        <input v-model.number="generateForm.quantity" type="number" class="input-field" min="1" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">&nbsp;</label>
                        <button class="btn btn-primary" @click="generateBarcodes">Generate</button>
                    </div>
                </div>
            </div>

            <div v-if="generatedCodes.length > 0" class="card">
                <h3>Generated Barcodes</h3>
                <div class="barcode-grid">
                    <div v-for="code in generatedCodes" :key="code.id" class="barcode-item">
                        <div class="barcode-value font-mono">{{ code.barcode }}</div>
                        <div class="barcode-data text-muted">{{ code.qr_data }}</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>Scan Barcode</h3>
                <div class="form-group">
                    <label class="form-label">Barcode / QR Code</label>
                    <input v-model="scanCode" class="input-field" placeholder="Enter barcode or scan QR" />
                </div>
                <button class="btn btn-primary" @click="scanBarcode">Scan</button>

                <div v-if="scanResult" class="scan-result mt-3">
                    <h4>Result</h4>
                    <div><strong>Item:</strong> {{ scanResult.item?.name }}</div>
                    <div><strong>Code:</strong> {{ scanResult.item?.code }}</div>
                    <div><strong>Current Stock:</strong> {{ scanResult.current_stock }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'

const generateForm = reactive({ item_type: 'raw_material', item_id: '', batch_number: '', quantity: 1 })
const generatedCodes = ref([])
const scanCode = ref('')
const scanResult = ref(null)

const items = computed(() => {
    return generateForm.item_type === 'raw_material' ? rawMaterials.value : products.value
})

const rawMaterials = ref([])
const products = ref([])

async function loadItems() {
    try {
        const rmRes = await api.get('/master/raw-materials')
        if (rmRes.data.success) rawMaterials.value = rmRes.data.data
        const prodRes = await api.get('/master/products')
        if (prodRes.data.success) products.value = prodRes.data.data
    } catch (error) { console.error(error) }
}

async function generateBarcodes() {
    if (!generateForm.item_id) {
        window.showToast?.({ type: 'error', message: 'Please select an item' })
        return
    }
    try {
        const response = await api.get('/barcode/generate', { params: generateForm })
        if (response.data.success) {
            generatedCodes.value = response.data.data
            window.showToast?.({ type: 'success', message: `Generated ${generatedCodes.value.length} barcodes` })
        }
    } catch (error) { window.showToast?.({ type: 'error', message: 'Generation failed' }) }
}

async function scanBarcode() {
    if (!scanCode.value) return
    try {
        const response = await api.post('/barcode/scan', { barcode: scanCode.value })
        if (response.data.success) {
            scanResult.value = response.data.data
        }
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Barcode not found' })
        scanResult.value = null
    }
}

onMounted(loadItems)
</script>

<style scoped>
.barcode-section { display: flex; flex-direction: column; gap: 16px; }
.barcode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
.barcode-item { padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); }
.barcode-value { font-size: 14px; font-weight: 600; }
.barcode-data { font-size: 11px; word-break: break-all; }
.scan-result { padding: 12px; background: var(--success-bg); border: 1px solid var(--success); }
</style>
