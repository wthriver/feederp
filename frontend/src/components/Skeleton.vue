<template>
  <div class="skeleton-wrapper">
    <div v-if="variant === 'table'" class="skeleton-table">
      <div class="skeleton-thead">
        <div v-for="col in columns" :key="col" class="skeleton-th">
          <Skeleton variant="text" :width="col.width || '80px'" />
        </div>
      </div>
      <div v-for="row in rows" :key="row" class="skeleton-tr">
        <div v-for="col in columns" :key="col" class="skeleton-td">
          <Skeleton variant="text" :width="col.width || (Math.random() > 0.5 ? '100%' : '60%')" />
        </div>
      </div>
    </div>
    <div v-else-if="variant === 'card'" class="skeleton-card">
      <Skeleton variant="rectangular" height="120px" />
      <div class="skeleton-card-body">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
    <div v-else-if="variant === 'list'" class="skeleton-list">
      <div v-for="i in rows" :key="i" class="skeleton-list-item">
        <Skeleton variant="circular" width="40px" height="40px" />
        <div class="skeleton-list-content">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="80%" />
        </div>
      </div>
    </div>
    <div v-else class="skeleton" :class="[variant, { 'animate-pulse': animate }]" :style="skeletonStyle">
      <span class="skeleton-text" v-if="variant === 'text'">&nbsp;</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Skeleton from './Skeleton.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'text',
    validator: (v) => ['text', 'circular', 'rectangular', 'avatar', 'table', 'card', 'list'].includes(v)
  },
  width: String,
  height: String,
  rows: {
    type: Number,
    default: 5
  },
  columns: {
    type: Array,
    default: () => [
      { width: '100px' },
      { width: '150px' },
      { width: '80px' },
      { width: '100px' }
    ]
  },
  animate: {
    type: Boolean,
    default: true
  }
})

const skeletonStyle = computed(() => ({
  width: props.width || (props.variant === 'circular' ? '40px' : '100%'),
  height: props.height || (props.variant === 'text' ? '16px' : props.variant === 'circular' ? '40px' : '20px')
}))
</script>

<style scoped>
.skeleton-wrapper {
  width: 100%;
}

.skeleton-table {
  display: table;
  width: 100%;
  border-collapse: collapse;
}

.skeleton-thead, .skeleton-tr {
  display: table-row;
}

.skeleton-th, .skeleton-td {
  display: table-cell;
  padding: 12px 8px;
  border-bottom: 1px solid var(--border-light);
}

.skeleton-th {
  font-weight: 500;
  color: var(--text-muted);
}

.skeleton-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.skeleton-list-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>