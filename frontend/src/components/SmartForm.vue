<template>
  <form @submit.prevent="handleSubmit" class="smart-form">
    <div v-if="errors.length" class="form-errors">
      <div v-for="(err, idx) in errors" :key="idx" class="error-item">
        {{ err }}
      </div>
    </div>

    <div class="form-grid">
      <div 
        v-for="field in fields" 
        :key="field.name"
        class="form-field"
        :class="{ 'field-full': field.fullWidth, 'field-error': fieldErrors[field.name] }"
      >
        <label v-if="field.label" :for="field.name" class="form-label">
          {{ field.label }}
          <span v-if="field.required" class="required">*</span>
        </label>

        <template v-if="field.type === 'select'">
          <select
            :id="field.name"
            v-model="formData[field.name]"
            class="input-field"
            :disabled="field.disabled"
          >
            <option value="">{{ field.placeholder || 'Select...' }}</option>
            <option 
              v-for="opt in field.options" 
              :key="opt.value" 
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </template>

        <template v-else-if="field.type === 'textarea'">
          <textarea
            :id="field.name"
            v-model="formData[field.name]"
            class="input-field"
            :rows="field.rows || 3"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
          ></textarea>
        </template>

        <template v-else-if="field.type === 'date'">
          <input
            :id="field.name"
            type="date"
            v-model="formData[field.name]"
            class="input-field"
            :disabled="field.disabled"
          />
        </template>

        <template v-else-if="field.type === 'number'">
          <input
            :id="field.name"
            type="number"
            v-model.number="formData[field.name]"
            class="input-field"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            :min="field.min"
            :max="field.max"
            :step="field.step || 'any'"
          />
        </template>

        <template v-else-if="field.type === 'checkbox'">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="formData[field.name]"
              :disabled="field.disabled"
            />
            <span>{{ field.checkboxLabel }}</span>
          </label>
        </template>

        <template v-else-if="field.type === 'currency'">
          <div class="currency-input">
            <span class="currency-symbol">₹</span>
            <input
              :id="field.name"
              type="number"
              v-model.number="formData[field.name]"
              class="input-field"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              :min="field.min"
              :step="field.step || '0.01'"
            />
          </div>
        </template>

        <template v-else>
          <input
            :id="field.name"
            :type="field.type || 'text'"
            v-model="formData[field.name]"
            class="input-field"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
          />
        </template>

        <span v-if="fieldErrors[field.name]" class="field-error-message">
          {{ fieldErrors[field.name] }}
        </span>

        <span v-if="field.hint" class="field-hint">{{ field.hint }}</span>
      </div>
    </div>

    <div class="form-actions">
      <slot name="actions"></slot>
      <button 
        v-if="showSubmit" 
        type="submit" 
        class="btn btn-primary"
        :disabled="submitting"
      >
        <span v-if="submitting" class="btn-spinner"></span>
        {{ submitText }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'

const props = defineProps({
  fields: {
    type: Array,
    required: true
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  showSubmit: {
    type: Boolean,
    default: true
  },
  submitText: {
    type: String,
    default: 'Save'
  },
  validating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'change'])

const formData = reactive({})
const fieldErrors = reactive({})
const errors = ref([])
const submitting = ref(false)

props.fields.forEach(field => {
  const defaultValue = field.type === 'checkbox' ? false : 
                       field.type === 'number' ? null : ''
  formData[field.name] = props.initialData[field.name] !== undefined 
    ? props.initialData[field.name] 
    : defaultValue
})

const validateField = (field) => {
  const value = formData[field.name]
  
  if (field.required && (value === '' || value === null || value === undefined)) {
    fieldErrors[field.name] = `${field.label} is required`
    return false
  }
  
  if (field.type === 'number' && field.min !== undefined && value < field.min) {
    fieldErrors[field.name] = `Minimum value is ${field.min}`
    return false
  }
  
  if (field.type === 'number' && field.max !== undefined && value > field.max) {
    fieldErrors[field.name] = `Maximum value is ${field.max}`
    return false
  }
  
  if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    fieldErrors[field.name] = 'Invalid email format'
    return false
  }
  
  delete fieldErrors[field.name]
  return true
}

const validate = () => {
  errors.value = []
  let isValid = true
  
  props.fields.forEach(field => {
    if (!validateField(field)) {
      isValid = false
    }
  })
  
  return isValid
}

const handleSubmit = async () => {
  errors.value = []
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  
  if (!validate()) {
    errors.value.push('Please fix the errors below')
    return
  }
  
  submitting.value = true
  
  try {
    await emit('submit', { ...formData })
  } catch (error) {
    if (error.response?.data?.error?.details) {
      error.response.data.error.details.forEach(err => {
        if (formData.hasOwnProperty(err.field)) {
          fieldErrors[err.field] = err.message
        }
      })
      errors.value.push(error.response.data.error.message)
    } else {
      errors.value.push(error.message || 'An error occurred')
    }
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  props.fields.forEach(field => {
    const defaultValue = field.type === 'checkbox' ? false : 
                         field.type === 'number' ? null : ''
    formData[field.name] = defaultValue
  })
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  errors.value = []
}

const setFieldValue = (name, value) => {
  formData[name] = value
}

defineExpose({
  formData,
  validate,
  resetForm,
  setFieldValue,
  submitting
})
</script>

<style scoped>
.smart-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-errors {
  padding: 12px;
  background: var(--danger-bg);
  border: 1px solid var(--danger);
  border-radius: 4px;
}

.error-item {
  color: var(--danger);
  font-size: var(--font-size-sm);
  margin-bottom: 4px;
}

.error-item:last-child {
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field.field-full {
  grid-column: 1 / -1;
}

.field-error .input-field {
  border-color: var(--danger);
}

.field-error-message {
  color: var(--danger);
  font-size: var(--font-size-xs);
}

.field-hint {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.currency-input {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
}

.currency-input .input-field {
  padding-left: 28px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.required {
  color: var(--danger);
}
</style>