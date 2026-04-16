<template>
  <div class="data-table-wrapper">
    <div class="table-header" v-if="$slots.toolbar || searchable || filterable">
      <slot name="toolbar"></slot>
      <div class="table-controls">
        <div v-if="searchable" class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            :placeholder="searchPlaceholder"
            class="input-field"
            @input="debouncedSearch"
          />
        </div>
        <div v-if="filterable && filters.length" class="filter-controls">
          <select v-model="selectedFilters" multiple class="filter-select">
            <option v-for="f in filters" :key="f.key" :value="f.key">{{ f.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <LoadingSpinner v-if="loading" :loading="true" :inline="false">
      <div class="skeleton-table">
        <div class="skeleton-row header">
          <div v-for="n in columns.length" :key="n" class="skeleton-cell">
            <Skeleton variant="text" width="80%" height="16px" />
          </div>
        </div>
        <div v-for="n in 5" :key="n" class="skeleton-row">
          <div v-for="col in columns" :key="col.key" class="skeleton-cell">
            <Skeleton 
              :variant="col.type === 'actions' ? 'circular' : 'text'" 
              :width="col.width || '60%'" 
              :height="col.height || '14px'" 
            />
          </div>
        </div>
      </div>
    </LoadingSpinner>

    <EmptyState
      v-else-if="!data || data.length === 0"
      :icon="emptyIcon"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template #action>
        <slot name="empty-action"></slot>
      </template>
    </EmptyState>

    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th 
              v-for="col in columns" 
              :key="col.key"
              :style="{ width: col.width, textAlign: col.align || 'left' }"
              :class="{ sortable: col.sortable }"
              @click="col.sortable && handleSort(col.key)"
            >
              {{ col.label }}
              <span v-if="col.sortable" class="sort-icon">
                {{ sortKey === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕' }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in paginatedData" :key="row.id || index" @click="$emit('row-click', row)">
            <td 
              v-for="col in columns" 
              :key="col.key"
              :style="{ textAlign: col.align || 'left' }"
              :class="{ 'clickable': col.clickable }"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                <template v-if="col.type === 'date'">
                  {{ formatDate(row[col.key]) }}
                </template>
                <template v-else-if="col.type === 'currency'">
                  {{ formatCurrency(row[col.key]) }}
                </template>
                <template v-else-if="col.type === 'number'">
                  {{ formatNumber(row[col.key]) }}
                </template>
                <template v-else-if="col.type === 'badge'">
                  <span class="badge" :class="col.getClass?.(row[col.key])">
                    {{ row[col.key] }}
                  </span>
                </template>
                <template v-else-if="col.type === 'actions'">
                  <slot name="actions" :row="row"></slot>
                </template>
                <template v-else>
                  {{ row[col.key] ?? '-' }}
                </template>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination && totalPages > 1" class="table-pagination">
      <div class="pagination-info">
        Showing {{ startIndex + 1 }} to {{ endIndex }} of {{ total }} entries
      </div>
      <div class="pagination-controls">
        <button 
          class="btn btn-sm" 
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <span class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="btn btn-sm"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </span>
        <button 
          class="btn btn-sm" 
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
      <div class="page-size-select">
        <select v-model="pageSize" @change="handlePageSizeChange">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Skeleton from './Skeleton.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  searchable: {
    type: Boolean,
    default: true
  },
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  filterable: {
    type: Boolean,
    default: false
  },
  filters: {
    type: Array,
    default: () => []
  },
  pagination: {
    type: Boolean,
    default: true
  },
  page: {
    type: Number,
    default: 1
  },
  limit: {
    type: Number,
    default: 50
  },
  total: {
    type: Number,
    default: 0
  },
  emptyIcon: {
    type: String,
    default: '📭'
  },
  emptyTitle: {
    type: String,
    default: 'No data found'
  },
  emptyDescription: String
})

const emit = defineEmits(['search', 'filter', 'sort', 'page-change', 'row-click'])

const searchQuery = ref('')
const selectedFilters = ref([])
const currentPage = ref(props.page)
const pageSize = ref(props.limit)
const sortKey = ref('')
const sortOrder = ref('asc')

let searchTimeout = null

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('search', searchQuery.value)
  }, 300)
}

const filteredData = computed(() => {
  if (!props.data) return []
  return props.data
})

const sortedData = computed(() => {
  if (!sortKey.value) return filteredData.value
  
  return [...filteredData.value].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]
    
    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    
    const comparison = aVal < bVal ? -1 : 1
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
})

const totalPages = computed(() => Math.ceil(props.total / pageSize.value))

const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, props.total))

const paginatedData = computed(() => {
  if (props.pagination) {
    const start = (currentPage.value - 1) * pageSize.value
    return sortedData.value.slice(start, start + pageSize.value)
  }
  return sortedData.value
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  const maxVisible = 5
  
  let start = Math.max(1, current - Math.floor(maxVisible / 2))
  let end = Math.min(total, start + maxVisible - 1)
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
  emit('sort', { key: sortKey.value, order: sortOrder.value })
}

const goToPage = (page) => {
  currentPage.value = page
  emit('page-change', page)
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  emit('page-change', { page: 1, limit: pageSize.value })
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
}

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-IN').format(value)
}

watch(() => props.page, (newPage) => {
  currentPage.value = newPage
})
</script>

<style scoped>
.data-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.table-controls {
  display: flex;
  gap: 12px;
}

.search-box .input-field {
  width: 250px;
  padding: 8px 12px;
}

.filter-select {
  padding: 8px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}

.skeleton-table {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-row {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
}

.skeleton-row.header {
  background: var(--bg-header);
}

.skeleton-cell {
  flex: 1;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.data-table th {
  background: var(--bg-header);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  white-space: nowrap;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  background: var(--bg-tertiary);
}

.sort-icon {
  margin-left: 4px;
  opacity: 0.5;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.data-table tbody tr.clickable {
  cursor: pointer;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.badge.success { background: var(--success-bg); color: var(--success); }
.badge.warning { background: var(--warning-bg); color: var(--warning); }
.badge.danger { background: var(--danger-bg); color: var(--danger); }
.badge.info { background: var(--info-bg); color: var(--info); }

.table-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-info {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.pagination-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.pagination-controls .btn.active {
  background: var(--primary);
  color: white;
}

.page-size-select select {
  padding: 6px 10px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box .input-field {
    width: 100%;
  }
  
  .table-pagination {
    flex-direction: column;
    align-items: center;
  }
}
</style>