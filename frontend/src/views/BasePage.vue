<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ pageName }}</h1>
            <button v-if="hasAddPermission" class="btn btn-primary" @click="$emit('add')">+ {{ $t('common.add') }}</button>
        </div>
        <div class="toolbar">
            <input v-model="search" type="text" :placeholder="$t('common.search')" class="input-field" @input="debounceSearch" />
            <slot name="filters"></slot>
        </div>
        <div v-if="loading" class="loading"><div class="spinner"></div></div>
        <div v-else>
            <slot name="table"></slot>
        </div>
        <div class="pagination">
            <div class="pagination-info">Total: {{ meta.total }}</div>
        </div>
        <slot name="modal"></slot>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import api from '@/api'
import { useAuthStore } from '@/store/auth'

const props = defineProps({
    pageName: String,
    apiEndpoint: String,
    addPermission: Object
})

const emit = defineEmits(['add', 'edit', 'delete', 'view'])

const authStore = useAuthStore()
const loading = ref(false)
const data = ref([])
const search = ref('')
const meta = reactive({ page: 1, total: 0, totalPages: 0 })

const hasAddPermission = computed(() => {
    if (!props.addPermission) return true
    return authStore.hasPermission(props.addPermission.module, props.addPermission.action)
})

function debounceSearch() {
    setTimeout(() => loadData(), 300)
}

async function loadData() {
    loading.value = true
    try {
        const response = await api.get(props.apiEndpoint, { params: { search: search.value, page: meta.page } })
        if (response.data.success) {
            data.value = response.data.data
            Object.assign(meta, response.data.meta || { total: data.value.length })
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

defineExpose({ loadData, data, loading, meta })
</script>
