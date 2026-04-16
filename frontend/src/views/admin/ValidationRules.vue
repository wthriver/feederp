<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.validationRules') || 'Validation Rules' }}</h1>
            <button class="btn btn-primary" @click="openAddModal">+ Add Rule</button>
        </div>

        <div class="toolbar">
            <select v-model="filter.entity_type" class="select-field" @change="loadData">
                <option value="">All Entities</option>
                <option value="customers">Customers</option>
                <option value="suppliers">Suppliers</option>
                <option value="products">Products</option>
                <option value="raw_materials">Raw Materials</option>
                <option value="users">Users</option>
                <option value="accounts">Accounts</option>
                <option value="formulas">Formulas</option>
            </select>
            <select v-model="filter.is_active" class="select-field" @change="loadData">
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
            </select>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Entity</th>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="rule in data" :key="rule.id">
                        <td>{{ rule.name }}</td>
                        <td>{{ rule.entity_type }}</td>
                        <td class="font-mono">{{ rule.field }}</td>
                        <td><span class="badge badge-info">{{ rule.validation_type }}</span></td>
                        <td>{{ rule.priority }}</td>
                        <td>
                            <span :class="['badge', rule.is_active ? 'badge-success' : 'badge-secondary']">
                                {{ rule.is_active ? 'Active' : 'Inactive' }}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm" @click="editRule(rule)">Edit</button>
                            <button class="btn btn-sm" @click="toggleRule(rule)">
                                {{ rule.is_active ? 'Disable' : 'Enable' }}
                            </button>
                            <button class="btn btn-sm btn-danger" @click="deleteRule(rule)">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" :title="editing ? 'Edit Rule' : 'Add Rule'" size="md">
            <div class="form-row-4">
                <div class="form-group span-3">
                    <label class="form-label">Name *</label>
                    <input v-model="form.name" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <input v-model.number="form.priority" type="number" class="input-field" />
                </div>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Entity Type *</label>
                    <select v-model="form.entity_type" class="select-field" :disabled="editing">
                        <option value="">Select</option>
                        <option value="customers">Customers</option>
                        <option value="suppliers">Suppliers</option>
                        <option value="products">Products</option>
                        <option value="raw_materials">Raw Materials</option>
                        <option value="users">Users</option>
                        <option value="accounts">Accounts</option>
                        <option value="formulas">Formulas</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Field *</label>
                    <input v-model="form.field" class="input-field" :disabled="editing" />
                </div>
                <div class="form-group span-2">
                    <label class="form-label">Validation Type *</label>
                    <select v-model="form.validation_type" class="select-field" @change="onTypeChange">
                        <option value="">Select</option>
                        <option value="required">Required</option>
                        <option value="unique">Unique</option>
                        <option value="pattern">Pattern</option>
                        <option value="range">Range</option>
                        <option value="dependent">Dependent</option>
                        <option value="duplication">Duplication</option>
                    </select>
                </div>
            </div>

            <div v-if="form.validation_type === 'pattern'" class="form-group" style="margin-top: 6px;">
                <label class="form-label">Regex Pattern</label>
                <input v-model="form.config.pattern" class="input-field font-mono" />
            </div>

            <div v-if="form.validation_type === 'range'" class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Min Value</label>
                    <input v-model.number="form.config.min" type="number" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Max Value</label>
                    <input v-model.number="form.config.max" type="number" class="input-field" />
                </div>
            </div>

            <div v-if="form.validation_type === 'dependent'" class="form-group" style="margin-top: 6px;">
                <label class="form-label">Required When (Field)</label>
                <input v-model="form.config.required_when.field" class="input-field" />
            </div>

            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Error Message</label>
                <input v-model="form.error_message" class="input-field" />
            </div>

            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">
                    <input type="checkbox" v-model="form.is_active" />
                    Active
                </label>
            </div>

            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="saveRule" :disabled="saving">
                    {{ saving ? 'Saving...' : 'Save' }}
                </button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const saving = ref(false)
const data = ref([])
const showModal = ref(false)
const editing = ref(null)
const filter = reactive({ entity_type: '', is_active: '' })

const form = reactive({
    name: '',
    entity_type: '',
    field: '',
    validation_type: '',
    priority: 0,
    config: {},
    error_message: '',
    is_active: true
})

function resetForm() {
    Object.assign(form, {
        name: '',
        entity_type: '',
        field: '',
        validation_type: '',
        priority: 0,
        config: {},
        error_message: '',
        is_active: true
    })
}

function onTypeChange() {
    form.config = {}
}

async function loadData() {
    loading.value = true
    try {
        const params = { ...filter }
        const response = await api.get('/validation/rules', { params })
        if (response.data.success) {
            data.value = response.data.data
        }
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

function openAddModal() {
    editing.value = null
    resetForm()
    showModal.value = true
}

function editRule(rule) {
    editing.value = rule
    Object.assign(form, {
        ...rule,
        config: rule.config || {}
    })
    showModal.value = true
}

async function saveRule() {
    if (!form.name || !form.entity_type || !form.field || !form.validation_type) {
        window.showToast?.({ type: 'error', message: 'Please fill all required fields' })
        return
    }

    saving.value = true
    try {
        if (editing.value) {
            await api.put(`/validation/rules/${editing.value.id}`, form)
            window.showToast?.({ type: 'success', message: 'Rule updated' })
        } else {
            await api.post('/validation/rules', form)
            window.showToast?.({ type: 'success', message: 'Rule created' })
        }
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: error.response?.data?.error?.message || 'Save failed' })
    } finally {
        saving.value = false
    }
}

async function toggleRule(rule) {
    try {
        await api.put(`/validation/rules/${rule.id}`, { ...rule, is_active: !rule.is_active })
        window.showToast?.({ type: 'success', message: `Rule ${rule.is_active ? 'disabled' : 'enabled'}` })
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Update failed' })
    }
}

async function deleteRule(rule) {
    window.showConfirm?.({
        title: 'Delete Rule',
        message: `Delete "${rule.name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            try {
                await api.delete(`/validation/rules/${rule.id}`)
                window.showToast?.({ type: 'success', message: 'Rule deleted' })
                loadData()
            } catch (error) {
                window.showToast?.({ type: 'error', message: 'Delete failed' })
            }
        }
    })
}

onMounted(loadData)
</script>

<style scoped>
</style>
