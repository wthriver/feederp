<template>
    <router-view />
    <ToastContainer />
    <ConfirmDialog ref="confirmDialog" />
</template>

<script setup>
import { ref } from 'vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { showToast } from '@/composables/useToast'

const confirmDialog = ref(null)

window.showToast = showToast
window.showConfirm = (options) => confirmDialog.value?.open(options)
</script>
