<template>
    <div class="data-page">
        <div class="page-header">
            <h1>Job Cards</h1>
            <button class="btn btn-primary" @click="openModal()">+ Create Job</button>
        </div>

        <div v-if="loading" class="loading"><div class="spinner"></div></div>

        <div v-else-if="data.length === 0" class="empty-state">
            <p>No job cards found.</p>
        </div>

        <div v-else class="table-container">
            <table class="sheet-grid">
                <thead>
                    <tr>
                        <th>Job No</th>
                        <th>Title</th>
                        <th>Assigned To</th>
                        <th>Machine</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in data" :key="item.id">
                        <td class="font-mono">{{ item.job_number }}</td>
                        <td>{{ item.title }}</td>
                        <td>{{ item.assigned_to || '-' }}</td>
                        <td>{{ item.machine_name || '-' }}</td>
                        <td>{{ item.start_time || '-' }}</td>
                        <td>{{ item.end_time || '-' }}</td>
                        <td>
                            <span :class="['badge', item.status === 'completed' ? 'badge-success' : item.status === 'in_progress' ? 'badge-warning' : 'badge-secondary']">
                                {{ item.status || 'pending' }}
                            </span>
                        </td>
                        <td>
                            <button v-if="item.status === 'pending'" class="btn btn-sm btn-icon" @click="startJob(item)" title="Start">▶️</button>
                            <button v-if="item.status === 'in_progress'" class="btn btn-sm btn-icon" @click="completeJob(item)" title="Complete">✓</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <AppModal v-model="showModal" title="Create Job Card" size="sm" :loading="saving">
            <div class="form-row-4">
                <div class="form-group span-3">
                    <label class="form-label">Title *</label>
                    <input v-model="form.title" class="input-field" />
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select v-model="form.priority" class="select-field">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top: 6px;">
                <label class="form-label">Description</label>
                <textarea v-model="form.description" class="input-field" rows="2"></textarea>
            </div>
            <div class="form-row-4" style="margin-top: 6px;">
                <div class="form-group">
                    <label class="form-label">Machine</label>
                    <select v-model="form.machine_id" class="select-field">
                        <option value="">Select</option>
                        <option v-for="m in machines" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
                <div class="form-group span-3">
                    <label class="form-label">Assigned To</label>
                    <input v-model="form.assigned_to" class="input-field" />
                </div>
            </div>
            <template #footer>
                <button class="btn" @click="showModal = false">Cancel</button>
                <button class="btn btn-primary" @click="save">Create</button>
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
const machines = ref([])
const showModal = ref(false)

const form = reactive({ title: '', description: '', machine_id: '', assigned_to: '', priority: 'medium', scheduled_date: '' })

async function loadData() {
    loading.value = true
    try {
        const [jobsRes, machinesRes] = await Promise.all([
            api.get('/master/job-cards'),
            api.get('/production/machines')
        ])
        if (jobsRes.data.success) data.value = jobsRes.data.data
        if (machinesRes.data.success) machines.value = machinesRes.data.data
    } catch (error) { console.error(error) }
    finally { loading.value = false }
}

function openModal() {
    Object.assign(form, { title: '', description: '', machine_id: '', assigned_to: '', priority: 'medium', scheduled_date: '' })
    showModal.value = true
}

async function save() {
    if (!form.title) {
        window.showToast?.({ type: 'error', message: 'Title is required' })
        return
    }
    saving.value = true
    try {
        await api.post('/master/job-cards', form)
        window.showToast?.({ type: 'success', message: 'Created successfully' })
        showModal.value = false
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed to create' })
    } finally {
        saving.value = false
    }
}

async function startJob(item) {
    try {
        await api.post(`/master/job-cards/${item.id}/start`)
        window.showToast?.({ type: 'success', message: 'Job started' })
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed' })
    }
}

async function completeJob(item) {
    try {
        await api.post(`/master/job-cards/${item.id}/complete`)
        window.showToast?.({ type: 'success', message: 'Job completed' })
        loadData()
    } catch (error) {
        window.showToast?.({ type: 'error', message: 'Failed' })
    }
}

onMounted(loadData)
</script>