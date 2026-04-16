<template>
    <div class="documents-page">
        <div class="page-header">
            <h1>Documents</h1>
            <div class="header-actions">
                <button class="btn btn-primary" @click="showUploadModal = true">
                    + Upload
                </button>
            </div>
        </div>

        <div class="tabs">
            <button :class="['tab', { active: activeTab === 'all' }]" @click="activeTab = 'all'; loadDocuments()">
                All Documents
            </button>
            <button :class="['tab', { active: activeTab === 'recent' }]" @click="activeTab = 'recent'; loadRecent()">
                Recent Uploads
            </button>
        </div>

        <div v-if="loading" class="loading">
            <LoadingSpinner />
        </div>

        <div v-else-if="documents.length === 0" class="empty-state">
            <EmptyState title="No Documents" message="Upload your first document" />
        </div>

        <div v-else class="documents-grid">
            <div v-for="doc in documents" :key="doc.id" class="document-card" @click="selectDocument(doc)">
                <div class="doc-icon">
                    <span v-if="doc.file_type === '.pdf'">📄</span>
                    <span v-else-if="doc.file_type?.startsWith('.xls')">📊</span>
                    <span v-else-if="doc.file_type?.startsWith('.doc')">📝</span>
                    <span v-else-if="doc.mime_type?.startsWith('image/')">🖼️</span>
                    <span v-else>📎</span>
                </div>
                <div class="doc-info">
                    <span class="doc-name" :title="doc.file_name">{{ doc.file_name }}</span>
                    <span class="doc-meta">
                        {{ formatSize(doc.file_size) }} • {{ formatDate(doc.created_at) }}
                    </span>
                </div>
                <div class="doc-actions" @click.stop>
                    <button class="btn-icon" @click="downloadDocument(doc)" title="Download">
                        📥
                    </button>
                    <button class="btn-icon" @click="deleteDocument(doc)" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        </div>

        <AppModal v-model="showUploadModal" title="Upload Document" size="md" :loading="uploading">
            <div class="upload-zone" @dragover.prevent @drop.prevent="handleDrop">
                <input type="file" ref="fileInput" @change="handleFileSelect" hidden />
                <div v-if="!selectedFile" class="drop-zone" @click="$refs.fileInput.click()">
                    <span class="drop-icon">📁</span>
                    <p>Click to select or drag and drop</p>
                    <p class="hint">PDF, Word, Excel, Images up to 10MB</p>
                </div>
                <div v-else class="file-preview">
                    <span class="file-name">{{ selectedFile.name }}</span>
                    <span class="file-size">{{ formatSize(selectedFile.size) }}</span>
                    <button class="btn-icon" @click="selectedFile = null">✕</button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Entity Type</label>
                <select v-model="uploadForm.entity_type" class="input-field">
                    <option value="">Select Type</option>
                    <option value="purchase_order">Purchase Order</option>
                    <option value="sales_order">Sales Order</option>
                    <option value="product">Product</option>
                    <option value="raw_material">Raw Material</option>
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Entity ID</label>
                <input v-model="uploadForm.entity_id" type="text" class="input-field" placeholder="Enter entity ID" />
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea v-model="uploadForm.description" class="input-field" rows="3" placeholder="Optional description"></textarea>
            </div>
            <template #footer>
                <button class="btn" @click="showUploadModal = false">Cancel</button>
                <button class="btn btn-primary" @click="uploadDocument" :disabled="!selectedFile || !uploadForm.entity_type || uploading">
                    {{ uploading ? 'Uploading...' : 'Upload' }}
                </button>
            </template>
        </AppModal>

        <div v-if="showPreviewModal" class="modal-overlay" @click.self="showPreviewModal = false">
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3>{{ selectedDoc?.file_name }}</h3>
                    <button class="modal-close" @click="showPreviewModal = false">&times;</button>
                </div>
                <div class="modal-body preview-body">
                    <img v-if="selectedDoc?.mime_type?.startsWith('image/')" :src="selectedDoc.file_path" :alt="selectedDoc.file_name" />
                    <iframe v-else-if="selectedDoc?.file_type === '.pdf'" :src="selectedDoc.file_path"></iframe>
                    <div v-else class="no-preview">
                        <p>Preview not available</p>
                        <button class="btn btn-primary" @click="downloadDocument(selectedDoc)">Download</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import AppModal from '@/components/AppModal.vue'

const loading = ref(false)
const uploading = ref(false)
const activeTab = ref('all')
const documents = ref([])
const showUploadModal = ref(false)
const showPreviewModal = ref(false)
const selectedFile = ref(null)
const selectedDoc = ref(null)
const uploadForm = ref({
    entity_type: '',
    entity_id: '',
    description: ''
})

async function loadDocuments() {
    loading.value = true
    try {
        const response = await api.get('/documents', { params: { page: 1, limit: 50 } })
        if (response.data.success) {
            documents.value = response.data.data
        }
    } catch (error) {
        console.error('Failed to load documents:', error)
    } finally {
        loading.value = false
    }
}

async function loadRecent() {
    loading.value = true
    try {
        const response = await api.get('/documents', { params: { page: 1, limit: 12, sort: 'created_at DESC' } })
        if (response.data.success) {
            documents.value = response.data.data
        }
    } catch (error) {
        console.error('Failed to load recent:', error)
    } finally {
        loading.value = false
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0]
    if (file) {
        selectedFile.value = file
    }
}

function handleDrop(event) {
    const file = event.dataTransfer.files[0]
    if (file) {
        selectedFile.value = file
    }
}

async function uploadDocument() {
    if (!selectedFile.value || !uploadForm.value.entity_type) return
    
    uploading.value = true
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('entity_type', uploadForm.value.entity_type)
    formData.append('entity_id', uploadForm.value.entity_id)
    formData.append('description', uploadForm.value.description)
    
    try {
        await api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        window.showToast?.({ type: 'success', message: 'Document uploaded' })
        showUploadModal.value = false
        selectedFile.value = null
        uploadForm.value = { entity_type: '', entity_id: '', description: '' }
        loadDocuments()
    } catch (error) {
        console.error('Upload failed:', error)
    } finally {
        uploading.value = false
    }
}

function downloadDocument(doc) {
    window.open(`/api/documents/${doc.id}/download`, '_blank')
}

async function deleteDocument(doc) {
    window.showConfirm?.({
        title: 'Delete Document',
        message: `Delete "${doc.file_name}"?`,
        type: 'danger',
        confirmText: 'Delete',
        onConfirm: async () => {
            try {
                await api.delete(`/documents/${doc.id}`)
                documents.value = documents.value.filter(d => d.id !== doc.id)
                window.showToast?.({ type: 'success', message: 'Document deleted' })
            } catch (error) {
                console.error('Delete failed:', error)
            }
        }
    })
}

function selectDocument(doc) {
    selectedDoc.value = doc
    showPreviewModal.value = true
}

function formatSize(bytes) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024
        i++
    }
    return `${bytes.toFixed(1)} ${units[i]}`
}

function formatDate(date) {
    return new Date(date).toLocaleDateString()
}

onMounted(() => {
    loadDocuments()
})
</script>

<style scoped>
.documents-page {
    padding: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.page-header h1 {
    font-size: 18px;
    font-weight: 600;
}

.tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 12px;
}

.tab {
    padding: 8px 16px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
}

.tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

.documents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    overflow-y: auto;
}

.document-card {
    display: flex;
    flex-direction: column;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: 6px;
    cursor: pointer;
    transition: box-shadow 0.2s;
}

.document-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.doc-icon {
    font-size: 32px;
    text-align: center;
    margin-bottom: 8px;
}

.doc-info {
    flex: 1;
}

.doc-name {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.doc-meta {
    font-size: 12px;
    color: var(--text-muted);
}

.doc-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 8px;
    opacity: 0;
    transition: opacity 0.2s;
}

.document-card:hover .doc-actions {
    opacity: 1;
}

.btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
}

.upload-zone {
    border: 2px dashed var(--border-light);
    border-radius: 6px;
    padding: 24px;
    margin-bottom: 16px;
    text-align: center;
}

.drop-zone {
    cursor: pointer;
}

.drop-icon {
    font-size: 32px;
}

.drop-zone .hint {
    font-size: 12px;
    color: var(--text-muted);
}

.file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 4px;
}

.form-group {
    margin-bottom: 12px;
}

.form-group label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
}

.preview-body {
    max-height: 70vh;
    overflow: auto;
}

.preview-body img {
    max-width: 100%;
}

.preview-body iframe {
    width: 100%;
    height: 60vh;
    border: none;
}

.no-preview {
    padding: 48px;
    text-align: center;
}
</style>