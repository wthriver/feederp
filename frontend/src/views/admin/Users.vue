<template>
    <div class="data-page">
        <div class="page-header">
            <h1>{{ $t('nav.users') }}</h1>
            <button class="btn btn-primary" @click="openModal()">+ Add User</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>{{ $t('auth.username') }}</th>
                        <th>{{ $t('common.name') }}</th>
                        <th>Role</th>
                        <th>Factory</th>
                        <th>Last Login</th>
                        <th>{{ $t('common.status') }}</th>
                        <th>{{ $t('common.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.username }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ item.role_name }}</td>
                        <td>{{ item.factory_name }}</td>
                        <td>{{ item.last_login || '-' }}</td>
                        <td><span :class="['badge', item.is_active ? 'badge-success' : 'badge-secondary']">{{ item.is_active ? 'Active' : 'Inactive' }}</span></td>
                        <td>
                            <button class="btn btn-sm btn-icon" @click="editItem(item)">✏️</button>
                            <button class="btn btn-sm btn-icon" @click="resetPassword(item)">🔑</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editing ? 'Edit' : 'Add' }} User</h3>
                    <button class="modal-close" @click="showModal = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">{{ $t('auth.username') }} *</label>
                            <input v-model="form.username" class="input-field" :disabled="editing" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">{{ $t('common.name') }} *</label>
                            <input v-model="form.name" class="input-field" required />
                        </div>
                    </div>
                    <div class="form-group" v-if="!editing">
                        <label class="form-label">Password *</label>
                        <input v-model="form.password" type="password" class="input-field" required />
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Role *</label>
                            <select v-model="form.role_id" class="select-field">
                                <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Factory</label>
                            <select v-model="form.factory_id" class="select-field">
                                <option value="">All</option>
                                <option v-for="f in factories" :key="f.id" :value="f.id">{{ f.name }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input v-model="form.email" type="email" class="input-field" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phone</label>
                            <input v-model="form.phone" class="input-field" />
                        </div>
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
const data = ref([])
const roles = ref([])
const factories = ref([])
const showModal = ref(false)
const editing = ref(null)

const form = reactive({ username: '', name: '', password: '', role_id: '', factory_id: '', email: '', phone: '' })

async function loadData() {
    loading.value = true
    try {
        const response = await api.get('/admin/users')
        if (response.data.success) data.value = response.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

async function loadRoles() {
    try {
        const response = await api.get('/admin/roles')
        if (response.data.success) roles.value = response.data.data
    } catch (error) { console.error(error) }
}

async function loadFactories() {
    try {
        const response = await api.get('/master/factories')
        if (response.data.success) factories.value = response.data.data
    } catch (error) { console.error(error) }
}

function openModal() {
    editing.value = null
    Object.assign(form, { username: '', name: '', password: '', role_id: '', factory_id: '', email: '', phone: '' })
    showModal.value = true
}

function editItem(item) {
    editing.value = item
    Object.assign(form, item)
    showModal.value = true
}

async function save() {
    try {
        if (editing.value) await api.put(`/admin/users/${editing.value.id}`, form)
        else await api.post('/admin/users', form)
        window.showToast?.({ type: 'success', message: 'Saved successfully' })
        showModal.value = false
        loadData()
    } catch (error) { window.showToast?.({ type: 'error', message: 'Save failed' }) }
}

async function resetPassword(item) {
    const newPass = prompt('Enter new password:')
    if (!newPass) return
    try {
        await api.post(`/admin/users/${item.id}/reset-password`, { new_password: newPass })
        window.showToast?.({ type: 'success', message: 'Password reset' })
    } catch (error) { window.showToast?.({ type: 'error', message: 'Failed' }) }
}

onMounted(() => { loadData(); loadRoles(); loadFactories() })
</script>
