<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.' + pageTitle) }}</h1>
            <div class="header-actions">
                <button class="btn btn-primary" @click="showAddModal = true">
                    + {{ $t('common.add') }}
                </button>
            </div>
        </div>

        <div class="toolbar">
            <input
                v-model="searchQuery"
                type="text"
                :placeholder="$t('common.search')"
                class="input-field search-input"
                @input="debounceSearch"
            />
            <select v-model="filters.status" class="select-field" @change="loadData">
                <option value="">{{ $t('common.all') }} {{ $t('common.status') }}</option>
                <option value="active">{{ $t('common.active') }}</option>
                <option value="inactive">{{ $t('common.inactive') }}</option>
            </select>
            <button class="btn btn-sm" @click="exportData">📥 {{ $t('common.export') }}</button>
        </div>

        <div v-if="loading" class="loading">
            <div class="spinner"></div>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in data" :key="row.id" @click="selectRow(row)">
                        <td v-for="col in columns" :key="col.key">
                            <span v-if="col.type === 'status'" :class="['badge', `badge-${row[col.key]}`]">
                                {{ row[col.key] }}
                            </span>
                            <span v-else-if="col.type === 'currency'" class="font-mono">
                                ৳{{ formatNumber(row[col.key]) }}
                            </span>
                            <span v-else>{{ row[col.key] }}</span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click.stop="editRow(row)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click.stop="deleteRow(row)">🗑️</button>
                        </td>
                    </tr>
                    <tr v-if="data.length === 0">
                        <td :colspan="columns.length + 1" class="text-center text-muted">
                            {{ $t('common.noData') }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination">
            <div class="pagination-info">
                {{ $t('common.showing') }} {{ meta.from || 0 }} - {{ meta.to || 0 }} {{ $t('common.of') }} {{ meta.total }}
            </div>
            <div class="pagination-controls">
                <button
                    v-for="page in visiblePages"
                    :key="page"
                    :class="['pagination-btn', { active: page === meta.current_page }]"
                    @click="goToPage(page)"
                >
                    {{ page }}
                </button>
            </div>
        </div>

        <AppModal v-model="showAddModal" :title="(editingRow ? 'Edit' : 'Add') + ' ' + pageTitle" size="lg" :loading="saving">
            <slot name="form"></slot>
            <template #footer>
                <button class="btn" @click="showAddModal = false">{{ $t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="saveRow">{{ $t('common.save') }}</button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
    pageTitle: String,
    apiEndpoint: String,
    columns: Array
})

const loading = ref(false)
const data = ref([])
const searchQuery = ref('')
const filters = ref({ status: '' })
const showAddModal = ref(false)
const editingRow = ref(null)
const saving = ref(false)
const meta = ref({ current_page: 1, total: 0, from: 0, to: 0 })

const visiblePages = computed(() => {
    const total = Math.ceil(meta.value.total / 20)
    const current = meta.value.current_page
    const pages = []
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
        pages.push(i)
    }
    return pages
})

function formatNumber(num) {
    return num?.toLocaleString() || '0'
}

function debounceSearch() {
    setTimeout(() => loadData(), 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get(props.apiEndpoint, {
            params: {
                search: searchQuery.value,
                status: filters.value.status,
                page: meta.value.current_page
            }
        })
        if (response.data.success) {
            data.value = response.data.data
            meta.value = response.data.meta || meta.value
        }
    } catch (error) {
        console.error('Failed to load data:', error)
    } finally {
        loading.value = false
    }
}

function selectRow(row) {
    // Override in child component
}

function editRow(row) {
    editingRow.value = row
    showAddModal.value = true
}

async function deleteRow(row) {
    window.showConfirm?.({
        title: 'Delete Record',
        message: 'Are you sure you want to delete this record?',
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            await api.delete(`${props.apiEndpoint}/${row.id}`)
            window.showToast?.({ type: 'success', message: 'Record deleted' })
            loadData()
        }
    })
}

function saveRow() {
    saving.value = true
    // Override in child component
}

function exportData() {
    // Export logic
}

function goToPage(page) {
    meta.value.current_page = page
    loadData()
}

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.data-page {
    padding: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-shrink: 0;
}

.page-header h1 {
    font-size: 18px;
    font-weight: 600;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    flex-shrink: 0;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
}

.search-input {
    flex: 1;
    max-width: 300px;
}

.table-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid var(--border-light);
    background: var(--bg-primary);
}

.pagination {
    flex-shrink: 0;
    padding: 8px 0;
}
</style>
