<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.roles') }}</h1>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="roles-grid">
            <div v-for="role in data" :key="role.id" class="role-card">
                <h3>{{ role.name }}</h3>
                <p>{{ role.description }}</p>
                <div v-if="rolePermissions[role.id]" class="permissions-list">
                    <span v-for="(perms, module) in rolePermissions[role.id]" :key="module" class="perm-tag">
                        {{ module }}: {{ perms.join(', ') }}
                    </span>
                </div>
                <button class="btn btn-sm mt-2" @click="editPermissions(role)">✏️ Edit Permissions</button>
            </div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">Edit Permissions - {{ editingRole?.name }}</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div v-for="mod in modules" :key="mod.id" class="permission-module">
                        <h4>{{ mod.name }}</h4>
                        <div class="permission-checkboxes">
                            <label v-for="perm in permissionTypes" :key="perm" class="checkbox-label">
                                <input type="checkbox" :checked="hasPermission(mod.id, perm)" @change="togglePermission(mod.id, perm)" />
                                {{ perm }}
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" @click="showModal = false">{{ $t('common.cancel') }}</button>
                    <button class="btn btn-primary" @click="savePermissions">Save</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'

const loading = ref(false)
const data = ref([])
const rolePermissions = ref({})
const showModal = ref(false)
const editingRole = ref(null)
const selectedPermissions = ref({})

const modules = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'master', name: 'Master Data' },
    { id: 'purchase', name: 'Purchase' },
    { id: 'inventory', name: 'Inventory' },
    { id: 'production', name: 'Production' },
    { id: 'quality', name: 'Quality Control' },
    { id: 'sales', name: 'Sales' },
    { id: 'finance', name: 'Finance' },
    { id: 'transport', name: 'Transport' },
    { id: 'reports', name: 'Reports' },
    { id: 'admin', name: 'Admin' }
]

const permissionTypes = ['view', 'add', 'edit', 'delete', 'approve', 'export']

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/admin/roles')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadPermissions(roleId) {
    try {
        const response = await api.get(`/admin/roles/${roleId}/permissions`)
        if (response.data.success) {
            rolePermissions.value[roleId] = response.data.data
        }
    } catch (error) { console.error(error) }
}

function hasPermission(module, perm) {
    const perms = selectedPermissions.value[module] || []
    return perms.includes(perm)
}

function togglePermission(module, perm) {
    if (!selectedPermissions.value[module]) {
        selectedPermissions.value[module] = []
    }
    const idx = selectedPermissions.value[module].indexOf(perm)
    if (idx > -1) {
        selectedPermissions.value[module].splice(idx, 1)
    } else {
        selectedPermissions.value[module].push(perm)
    }
}

async function editPermissions(role) {
    editingRole.value = role
    selectedPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value[role.id] || {}))
    if (!rolePermissions.value[role.id]) {
        await loadPermissions(role.id)
        selectedPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value[role.id] || {}))
    }
    showModal.value = true
}

async function savePermissions() {
    try {
        const perms = []
        for (const [module, permList] of Object.entries(selectedPermissions.value)) {
            permList.forEach(perm => perms.push({ module, permission: perm }))
        }
        await api.put(`/admin/roles/${editingRole.value.id}/permissions`, { permissions: perms })
        window.showToast?.({ type: 'success', message: 'Permissions updated' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

onMounted(loadData)
</script>

<style scoped>
.roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.role-card { background: var(--bg-primary); border: 1px solid var(--border-light); padding: 16px; }
.role-card h3 { margin-bottom: 8px; }
.role-card p { font-size: var(--font-size-sm); color: var(--text-muted); margin-bottom: 12px; }
.permissions-list { display: flex; flex-wrap: wrap; gap: 4px; }
.perm-tag { font-size: 10px; padding: 2px 6px; background: var(--bg-secondary); border-radius: 2px; }
.permission-module { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); }
.permission-module h4 { margin-bottom: 8px; font-size: var(--font-size-sm); }
.permission-checkboxes { display: flex; gap: 12px; flex-wrap: wrap; }
.checkbox-label { display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm); cursor: pointer; }
</style>
