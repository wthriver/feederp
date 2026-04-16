<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.reports') }}</h1>
        </div>

        <div class="reports-grid">
            <div v-for="report in reports" :key="report.id" class="report-card" @click="generateReport(report)">
                <div class="report-icon">{{ report.icon }}</div>
                <h3>{{ report.name }}</h3>
                <p>{{ report.description }}</p>
            </div>
        </div>

        <div v-if="reportData" class="report-output">
            <div class="card">
                <div class="card-header">
                    <h3>{{ currentReport?.name }}</h3>
                    <div class="flex gap-2">
                        <button class="btn btn-sm" @click="exportPDF">📥 PDF</button>
                        <button class="btn btn-sm" @click="exportExcel">📥 Excel</button>
                        <button class="btn btn-sm" @click="printReport">🖨️ Print</button>
                    </div>
                </div>
                <div v-if="loading" class="loading"><div class="spinner"></div></div>
                <div v-else class="table-container">
                    <table class="sheet-grid">
                        <thead>
                            <tr>
                                <th v-for="col in reportColumns" :key="col">{{ col }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, idx) in reportData" :key="idx">
                                <td v-for="col in reportColumns" :key="col" class="font-mono">
                                    {{ formatValue(row[col]) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import api from '@/api'

const loading = ref(false)
const reportData = ref(null)
const reportColumns = ref([])
const currentReport = ref(null)

const reports = [
    { id: 'stock-position', route: '/stock-position', dataKey: 'stock', name: 'Stock Position', icon: '📦', description: 'Current stock levels across godowns' },
    { id: 'stock-valuation', route: '/stock-valuation', dataKey: 'raw_materials', name: 'Stock Valuation', icon: '💰', description: 'Stock value summary' },
    { id: 'production-summary', route: '/production-summary', dataKey: 'summary', name: 'Production Summary', icon: '🏭', description: 'Batch-wise production report' },
    { id: 'sales-summary', route: '/sales-summary', dataKey: 'invoices', name: 'Sales Summary', icon: '💵', description: 'Sales invoices and outstanding' },
    { id: 'profit-analysis', route: '/profit-analysis', dataKey: 'sales', name: 'Profit Analysis', icon: '📈', description: 'Revenue vs cost analysis' },
    { id: 'raw-material-usage', route: '/raw-material-usage', dataKey: 'usage', name: 'Raw Material Usage', icon: '🌾', description: 'Material consumption report' }
]

async function generateReport(report) {
    currentReport.value = report
    loading.value = true
    reportData.value = []
    reportColumns.value = []
    try {
        const response = await api.get(`/reports${report.route}`)
        if (response.data.success) {
            const key = report.dataKey
            let data = response.data.data?.[key] || []
            if (!Array.isArray(data)) data = data?.items || []
            reportData.value = data
            if (reportData.value.length > 0) {
                reportColumns.value = Object.keys(reportData.value[0])
            }
        }
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function formatValue(val) {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'number') return val.toLocaleString()
    return val
}

function exportPDF() {
    if (!currentReport.value) return
    window.showToast?.({ type: 'info', message: 'Generating PDF...' })
    const url = `${import.meta.env.VITE_API_URL || '/api'}/reports${currentReport.value.route}/export?format=pdf`
    window.open(url, '_blank')
}

function exportExcel() {
    if (!currentReport.value) return
    window.showToast?.({ type: 'info', message: 'Generating Excel...' })
    const url = `${import.meta.env.VITE_API_URL || '/api'}/reports${currentReport.value.route}/export?format=excel`
    window.open(url, '_blank')
}
function printReport() { window.print() }
</script>

<style scoped>
.reports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
.report-card { background: var(--bg-primary); border: 1px solid var(--border-light); padding: 20px; cursor: pointer; transition: all 0.2s; }
.report-card:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.report-icon { font-size: 32px; margin-bottom: 12px; }
.report-card h3 { font-size: var(--font-size-base); margin-bottom: 8px; }
.report-card p { font-size: var(--font-size-sm); color: var(--text-muted); }
.report-output { margin-top: 20px; }
</style>
