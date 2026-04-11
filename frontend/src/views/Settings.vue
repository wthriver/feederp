<template>
    <div class="settings-page">
        <div class="page-header">
            <h1>{{ $t('nav.settings') }}</h1>
        </div>

        <div class="settings-grid">
            <div class="settings-card">
                <h3>Company Settings</h3>
                <div class="form-group">
                    <label class="form-label">Company Name</label>
                    <input v-model="settings.company_name" type="text" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Currency</label>
                    <select v-model="settings.currency" class="select-field">
                        <option value="INR">Indian Rupee (INR)</option>
                        <option value="USD">US Dollar (USD)</option>
                        <option value="BDT">Bangladeshi Taka (BDT)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Decimal Places</label>
                    <select v-model="settings.decimal_places" class="select-field">
                        <option value="0">0</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                    </select>
                </div>
                <button class="btn btn-primary" @click="saveSettings">Save Settings</button>
            </div>

            <div class="settings-card">
                <h3>Appearance</h3>
                <div class="form-group">
                    <label class="form-label">Language</label>
                    <select v-model="locale" @change="changeLocale" class="select-field">
                        <option value="en">English</option>
                        <option value="bn">বাংলা</option>
                    </select>
                </div>
            </div>

            <div class="settings-card">
                <h3>System Information</h3>
                <div class="info-row">
                    <span class="info-label">Version</span>
                    <span class="info-value">1.0.0</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Database</span>
                    <span class="info-value">{{ dbType }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Environment</span>
                    <span class="info-value">{{ env }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api'

const { locale } = useI18n()

const settings = reactive({
    company_name: 'FeedMill ERP',
    currency: 'INR',
    decimal_places: '2'
})

const dbType = ref('SQLite')
const env = ref('Development')

async function loadSettings() {
    try {
        const response = await api.get('/master/settings')
        if (response.data.success) {
            Object.assign(settings, response.data.data)
        }
    } catch (error) {
        console.error('Failed to load settings:', error)
    }
}

async function saveSettings() {
    try {
        for (const [key, value] of Object.entries(settings)) {
            await api.put('/master/settings', { key, value })
        }
        window.showToast?.({ type: 'success', title: 'Success', message: 'Settings saved successfully' })
    } catch (error) {
        window.showToast?.({ type: 'error', title: 'Error', message: 'Failed to save settings' })
    }
}

function changeLocale() {
    localStorage.setItem('locale', locale.value)
    window.location.reload()
}

onMounted(() => {
    loadSettings()
    dbType.value = import.meta.env.VITE_DB_TYPE || 'SQLite'
    env.value = import.meta.env.MODE || 'Development'
})
</script>

<style scoped>
.settings-page {
    padding: 16px;
}

.page-header {
    margin-bottom: 20px;
}

.page-header h1 {
    font-size: 20px;
    font-weight: 600;
}

.settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
}

.settings-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    padding: 20px;
}

.settings-card h3 {
    font-size: var(--font-size-lg);
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-light);
}

.settings-card .input-field,
.settings-card .select-field {
    width: 100%;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-light);
}

.info-label {
    color: var(--text-muted);
}

.info-value {
    font-family: var(--font-data);
    font-weight: 500;
}
</style>
