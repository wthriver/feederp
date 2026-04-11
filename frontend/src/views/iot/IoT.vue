<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.iot') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add Device</button>
        </div>

        <div class="iot-grid">
            <div v-for="device in devices" :key="device.id" class="iot-card">
                <div class="iot-header">
                    <span class="iot-status" :class="device.status"></span>
                    <h3>{{ device.name }}</h3>
                </div>
                <div class="iot-info">
                    <div><strong>Code:</strong> {{ device.device_code }}</div>
                    <div><strong>Type:</strong> {{ device.type }}</div>
                    <div><strong>Protocol:</strong> {{ device.protocol }}</div>
                    <div><strong>Last Seen:</strong> {{ device.last_seen || 'Never' }}</div>
                </div>
                <div class="iot-actions">
                    <button class="btn btn-sm" @click="viewReadings(device)">📊 Readings</button>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">Add IoT Device</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Device Code *</label>
                        <input v-model="form.device_code" class="input-field" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input v-model="form.name" class="input-field" required />
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select v-model="form.type" class="select-field">
                                <option value="sensor">Sensor</option>
                                <option value="counter">Counter</option>
                                <option value="scale">Scale</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Protocol</label>
                            <select v-model="form.protocol" class="select-field">
                                <option value="http">HTTP</option>
                                <option value="mqtt">MQTT</option>
                                <option value="modbus">Modbus</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Endpoint URL</label>
                        <input v-model="form.endpoint" class="input-field" placeholder="http://..." />
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
const devices = ref([])
const showModal = ref(false)

const form = reactive({ device_code: '', name: '', type: 'sensor', protocol: 'http', endpoint: '', machine_id: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/iot/devices')
        if (response.data.success) devices.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() { showModal.value = true }

function viewReadings(device) { console.log('Readings', device) }

async function save() {
    try {
        await api.post('/iot/devices', form)
        window.showToast?.({ type: 'success', message: 'Device added' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(loadData)
</script>

<style scoped>
.iot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.iot-card { background: var(--bg-primary); border: 1px solid var(--border-light); padding: 16px; }
.iot-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.iot-status { width: 10px; height: 10px; border-radius: 50%; }
.iot-status.active { background: var(--success); }
.iot-status.inactive { background: var(--danger); }
.iot-info { font-size: var(--font-size-sm); }
.iot-info > div { margin-bottom: 4px; }
.iot-actions { margin-top: 12px; }
</style>
