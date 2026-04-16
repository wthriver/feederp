<template>
    <div class="toolbar" :class="{ 'toolbar-compact': compact }">
        <div class="toolbar-left">
            <div class="search-box" v-if="showSearch">
                <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input 
                    type="text" 
                    :value="modelValue.search"
                    :placeholder="searchPlaceholder || 'Search...'"
                    class="input-field"
                    @input="$emit('update:modelValue', { ...modelValue, search: $event.target.value })"
                    @keyup.enter="$emit('search')"
                />
            </div>

            <slot name="filters"></slot>

            <div class="divider-v" v-if="showSearch || $slots.filters"></div>
        </div>

        <div class="toolbar-center" v-if="$slots.center">
            <slot name="center"></slot>
        </div>

        <div class="spacer"></div>

        <div class="toolbar-right">
            <slot name="actions"></slot>

            <div class="view-toggle" v-if="showViewToggle">
                <button 
                    class="view-btn" 
                    :class="{ active: viewMode === 'table' }"
                    @click="$emit('update:viewMode', 'table')"
                    title="Table View"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <path d="M3 9h18M9 21V9"></path>
                    </svg>
                </button>
                <button 
                    class="view-btn" 
                    :class="{ active: viewMode === 'grid' }"
                    @click="$emit('update:viewMode', 'grid')"
                    title="Grid View"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                </button>
            </div>

            <button class="btn btn-sm" @click="$emit('refresh')" v-if="showRefresh" title="Refresh">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
            </button>
        </div>
    </div>
</template>

<script setup>
defineProps({
    modelValue: {
        type: Object,
        default: () => ({ search: '' })
    },
    compact: {
        type: Boolean,
        default: false
    },
    showSearch: {
        type: Boolean,
        default: true
    },
    showRefresh: {
        type: Boolean,
        default: true
    },
    showViewToggle: {
        type: Boolean,
        default: false
    },
    viewMode: {
        type: String,
        default: 'table'
    },
    searchPlaceholder: {
        type: String,
        default: ''
    }
})

defineEmits(['update:modelValue', 'search', 'refresh', 'update:viewMode'])
</script>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-light);
    flex-shrink: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
}

.toolbar::-webkit-scrollbar {
    height: 4px;
}

.toolbar::-webkit-scrollbar-thumb {
    background: var(--border-light);
    border-radius: 2px;
}

.toolbar-compact {
    padding: 6px 12px;
}

.toolbar-left,
.toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.toolbar-center {
    display: flex;
    align-items: center;
    gap: 8px;
}

.search-box {
    position: relative;
    flex: 0 0 200px;
}

.toolbar-compact .search-box {
    flex: 0 0 160px;
}

.search-box input {
    padding-left: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 6px;
    width: 100%;
}

.search-icon {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 4px;
}

.filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-light);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    color: var(--text-secondary);
}

.filter-chip:hover {
    border-color: var(--primary);
    color: var(--primary);
}

.filter-chip.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

.filter-chip select {
    border: none;
    background: transparent;
    font-size: 11px;
    padding: 0;
    margin-left: 4px;
    cursor: pointer;
    color: inherit;
    min-width: auto;
    height: auto;
}

.filter-chip select:focus {
    outline: none;
    box-shadow: none;
}

select.toolbar-select {
    height: 30px;
    padding: 4px 24px 4px 8px;
    font-size: 11px;
    border-radius: 4px;
    min-width: auto;
    background-size: 10px;
    background-position: right 6px center;
}

.divider-v {
    width: 1px;
    height: 20px;
    background: var(--border-light);
    margin: 0 4px;
    flex-shrink: 0;
}

.spacer {
    flex: 1;
}

.view-toggle {
    display: flex;
    background: var(--bg-secondary);
    border-radius: 4px;
    padding: 2px;
    gap: 2px;
}

.view-btn {
    padding: 4px 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 3px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
}

.view-btn:hover {
    color: var(--text-primary);
}

.view-btn.active {
    background: var(--bg-primary);
    color: var(--primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
    .toolbar {
        padding: 8px 12px;
        gap: 6px;
    }

    .search-box {
        flex: 0 0 140px;
    }

    .toolbar-compact .search-box {
        flex: 0 0 120px;
    }
}
</style>
