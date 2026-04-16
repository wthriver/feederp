<template>
    <div class="login-page">
        <div class="login-container">
            <div class="login-header">
                <h1>{{ $t('app.name') }}</h1>
                <p>{{ $t('app.tagline') }}</p>
            </div>

            <form @submit.prevent="handleLogin" class="login-form">
                <template v-if="!mfaRequired">
                    <div class="form-group">
                        <label class="form-label">{{ $t('auth.username') }}</label>
                        <input
                            v-model="form.username"
                            type="text"
                            class="input-field"
                            :class="{ 'input-error': errors.username }"
                            autocomplete="username"
                            required
                        />
                        <span v-if="errors.username" class="form-error">{{ errors.username }}</span>
                    </div>

                    <div class="form-group">
                        <label class="form-label">{{ $t('auth.password') }}</label>
                        <div class="password-input-wrapper">
                            <input
                                v-model="form.password"
                                :type="showPassword ? 'text' : 'password'"
                                class="input-field"
                                :class="{ 'input-error': errors.password }"
                                autocomplete="current-password"
                                required
                            />
                            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                                {{ showPassword ? '🙈' : '👁️' }}
                            </button>
                        </div>
                        <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
                    </div>

                    <div class="form-row">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.rememberMe" />
                            <span>Remember me</span>
                        </label>
                        <button type="button" class="link-btn" @click="showForgotPassword = true">
                            Forgot password?
                        </button>
                    </div>

                    <div v-if="errorMessage" class="error-message" :class="{ 'error-warning': isAccountLocked }">
                        <span v-if="isAccountLocked">🔒 </span>
                        {{ errorMessage }}
                        <span v-if="retryAfter"> (Retry in {{ retryAfter }}s)</span>
                    </div>

                    <button type="submit" class="btn btn-primary btn-lg" :disabled="loading || isAccountLocked">
                        <span v-if="loading" class="spinner-small"></span>
                        <span v-else>{{ $t('auth.login') }}</span>
                    </button>
                </template>

                <template v-else>
                    <div class="mfa-step">
                        <div class="mfa-icon">🔐</div>
                        <h3 class="mfa-title">Two-Factor Authentication</h3>
                        <p class="mfa-desc">Enter the 6-digit code from your authenticator app</p>
                        
                        <div class="form-group">
                            <label class="form-label">Verification Code</label>
                            <input
                                v-model="mfaCode"
                                type="text"
                                class="input-field mfa-input"
                                :class="{ 'input-error': errors.mfaCode }"
                                placeholder="000000"
                                maxlength="6"
                                autocomplete="one-time-code"
                                required
                            />
                            <span v-if="errors.mfaCode" class="form-error">{{ errors.mfaCode }}</span>
                        </div>

                        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

                        <div class="mfa-actions">
                            <button type="button" class="btn" @click="cancelMfa">
                                Back
                            </button>
                            <button type="submit" class="btn btn-primary" :disabled="loading || mfaCode.length !== 6">
                                <span v-if="loading" class="spinner-small"></span>
                                <span v-else>Verify</span>
                            </button>
                        </div>

                        <div class="mfa-help">
                            <button type="button" class="link-btn" @click="showBackupCodes = true">
                                Use backup code
                            </button>
                        </div>
                    </div>
                </template>
            </form>

            <div class="login-footer" v-if="!mfaRequired">
                <p>Don't have an account? <router-link to="/signup">Sign up</router-link></p>
            </div>
        </div>

        <div class="login-lang">
            <select v-model="locale" @change="changeLocale" class="select-field">
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
            </select>
        </div>

        <AppModal v-model="showForgotPassword" title="Reset Password" size="sm" :close-on-overlay="!resetLoading" :close-on-esc="!resetLoading">
            <template v-if="!resetSent">
                <p class="modal-desc">Enter your email address and we'll send you instructions to reset your password.</p>
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input
                        v-model="resetEmail"
                        type="email"
                        class="input-field"
                        placeholder="your@email.com"
                    />
                </div>
                <div v-if="resetError" class="error-message">{{ resetError }}</div>
            </template>
            <template v-else>
                <div class="success-message">
                    <span class="success-icon">✓</span>
                    <p>If an account exists with this email, you will receive password reset instructions.</p>
                </div>
            </template>
            <template #footer>
                <template v-if="!resetSent">
                    <button type="button" class="btn" @click="resetForgotForm" :disabled="resetLoading">Cancel</button>
                    <button type="button" class="btn btn-primary" @click="handleForgotPassword" :disabled="resetLoading">
                        <span v-if="resetLoading" class="spinner-small"></span>
                        <span v-else>Send Reset Link</span>
                    </button>
                </template>
                <button v-else type="button" class="btn btn-primary" @click="resetForgotForm">Back to Login</button>
            </template>
        </AppModal>

        <AppModal v-model="showBackupCodes" title="Use Backup Code" size="sm">
            <p class="modal-desc">Enter one of your backup codes instead of the verification code.</p>
            <div class="form-group">
                <label class="form-label">Backup Code</label>
                <input
                    v-model="backupCode"
                    type="text"
                    class="input-field"
                    placeholder="XXXX-XXXX"
                />
            </div>
            <template #footer>
                <button type="button" class="btn" @click="showBackupCodes = false">Cancel</button>
                <button type="button" class="btn btn-primary" @click="handleBackupCode" :disabled="!backupCode">
                    Verify with Backup Code
                </button>
            </template>
        </AppModal>
    </div>
</template>

<script setup>
import { ref, reactive, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store/auth'
import AppModal from '@/components/AppModal.vue'
import api from '@/api'
import { storeToRefs } from 'pinia'

const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()
const { token, refreshToken } = storeToRefs(authStore)

const form = reactive({
    username: '',
    password: '',
    rememberMe: false
})

const errors = reactive({})
const errorMessage = ref('')
const loading = ref(false)
const showPassword = ref(false)
const isAccountLocked = ref(false)
const retryAfter = ref(0)

const showForgotPassword = ref(false)
const resetEmail = ref('')
const resetError = ref('')
const resetLoading = ref(false)
const resetSent = ref(false)

const mfaRequired = ref(false)
const mfaCode = ref('')
const backupCode = ref('')
const showBackupCodes = ref(false)
const mfaUsername = ref('')

const REFRESH_TOKEN_KEY = 'refreshToken'

let retryTimer = null

function changeLocale() {
    localStorage.setItem('locale', locale.value)
}

async function handleLogin() {
    errors.username = ''
    errors.password = ''
    errorMessage.value = ''
    isAccountLocked.value = false
    retryAfter.value = 0

    if (retryTimer) {
        clearInterval(retryTimer)
        retryTimer = null
    }

    try {
        loading.value = true
        if (!form.username) {
            errors.username = 'Username is required'
            return
        }
        if (!form.password) {
            errors.password = 'Password is required'
            return
        }

        const response = await api.post('/auth/login', form)
        
        if (response.data.data?.mfaRequired) {
            mfaRequired.value = true
            mfaUsername.value = response.data.data.username
            return
        }
        
        await authStore.login(form)
        
        if (form.rememberMe) {
            localStorage.setItem('rememberUsername', form.username)
        } else {
            localStorage.removeItem('rememberUsername')
        }
        
        router.push('/dashboard')
    } catch (error) {
        const errorData = error.response?.data?.error
        if (errorData?.code === 'TOO_MANY_LOGINS') {
            isAccountLocked.value = true
            retryAfter.value = errorData.retryAfter || 900
            startRetryTimer(retryAfter.value)
        }
        if (errorData?.message) {
            errorMessage.value = errorData.message
        } else {
            errorMessage.value = 'Login failed. Please try again.'
        }
    } finally {
        loading.value = false
    }
}

async function handleMfaVerify() {
    errors.mfaCode = ''
    errorMessage.value = ''
    
    if (!mfaCode.value || mfaCode.value.length !== 6) {
        errors.mfaCode = 'Please enter a 6-digit code'
        return
    }
    
    try {
        loading.value = true
        const response = await api.post('/auth/mfa/verify', {
            username: mfaUsername.value,
            token: mfaCode.value
        })
        
        if (response.data.success && response.data.data?.mfaVerified) {
            token.value = response.data.data.accessToken
            refreshToken.value = response.data.data.refreshToken
            
            localStorage.setItem('token', response.data.data.accessToken)
            localStorage.setItem(REFRESH_TOKEN_KEY, response.data.data.refreshToken)
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.accessToken}`
            
            await authStore.fetchProfile()
            
            if (form.rememberMe) {
                localStorage.setItem('rememberUsername', mfaUsername.value)
            }
            
            router.push('/dashboard')
        }
    } catch (error) {
        const errorData = error.response?.data?.error
        if (errorData?.message) {
            errorMessage.value = errorData.message
        } else {
            errorMessage.value = 'Invalid verification code'
        }
        mfaCode.value = ''
    } finally {
        loading.value = false
    }
}

async function handleBackupCode() {
    errorMessage.value = ''
    
    if (!backupCode.value) {
        errorMessage.value = 'Please enter a backup code'
        return
    }
    
    try {
        loading.value = true
        const response = await api.post('/auth/mfa/verify', {
            username: mfaUsername.value,
            backupCode: backupCode.value
        })
        
        if (response.data.success && response.data.data?.mfaVerified) {
            token.value = response.data.data.accessToken
            refreshToken.value = response.data.data.refreshToken
            
            localStorage.setItem('token', response.data.data.accessToken)
            localStorage.setItem(REFRESH_TOKEN_KEY, response.data.data.refreshToken)
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.accessToken}`
            
            await authStore.fetchProfile()
            
            if (form.rememberMe) {
                localStorage.setItem('rememberUsername', mfaUsername.value)
            }
            
            showBackupCodes.value = false
            router.push('/dashboard')
        }
    } catch (error) {
        const errorData = error.response?.data?.error
        if (errorData?.message) {
            errorMessage.value = errorData.message
        } else {
            errorMessage.value = 'Invalid backup code'
        }
        backupCode.value = ''
    } finally {
        loading.value = false
    }
}

function cancelMfa() {
    mfaRequired.value = false
    mfaCode.value = ''
    errorMessage.value = ''
    errors.mfaCode = ''
}

async function handleForgotPassword() {
    if (!resetEmail.value) {
        resetError.value = 'Email is required'
        return
    }
    
    resetLoading.value = true
    resetError.value = ''
    
    try {
        const response = await api.post('/auth/forgot-password', { email: resetEmail.value })
        if (response.data.success) {
            resetSent.value = true
        }
    } catch (error) {
        const errorData = error.response?.data?.error
        if (errorData?.message) {
            resetError.value = errorData.message
        } else {
            resetError.value = 'Failed to process request. Please try again.'
        }
    } finally {
        resetLoading.value = false
    }
}

function startRetryTimer(seconds) {
    retryTimer = setInterval(() => {
        retryAfter.value--
        if (retryAfter.value <= 0) {
            isAccountLocked.value = false
            clearInterval(retryTimer)
            retryTimer = null
        }
    }, 1000)
}

function resetForgotForm() {
    showForgotPassword.value = false
    resetEmail.value = ''
    resetError.value = ''
    resetSent.value = false
}

onMounted(() => {
    const savedUsername = localStorage.getItem('rememberUsername')
    if (savedUsername) {
        form.username = savedUsername
        form.rememberMe = true
    }
})

onUnmounted(() => {
    if (retryTimer) {
        clearInterval(retryTimer)
    }
})
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    padding: 20px;
}

.login-container {
    width: 100%;
    max-width: 400px;
    background: var(--bg-primary);
    padding: 40px;
    border: 1px solid var(--border-medium);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.login-header {
    text-align: center;
    margin-bottom: 32px;
}

.login-header h1 {
    font-size: 24px;
    color: var(--primary);
    margin-bottom: 8px;
}

.login-header p {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}

.login-form .form-group {
    margin-bottom: 20px;
}

.login-form .input-field {
    width: 100%;
}

.form-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
}

.checkbox-label input {
    width: 16px;
    height: 16px;
}

.link-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    text-decoration: underline;
}

.link-btn:hover {
    color: var(--primary-dark);
}

.password-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.password-input-wrapper .input-field {
    padding-right: 40px;
}

.password-toggle {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
}

.error-message {
    padding: 12px;
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger);
    margin-bottom: 16px;
    font-size: var(--font-size-sm);
}

.error-message.error-warning {
    background: var(--warning-bg);
    border-color: var(--warning);
    color: var(--warning);
}

.login-form .btn {
    width: 100%;
}

.login-footer {
    margin-top: 24px;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.login-footer a {
    color: var(--primary);
    font-weight: 500;
}

.login-footer a:hover {
    text-decoration: underline;
}

.login-lang {
    position: fixed;
    top: 20px;
    right: 20px;
}

.login-lang .select-field {
    background: rgba(255, 255, 255, 0.9);
    border: none;
}

.spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.modal-desc {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 16px;
}

.success-message {
    text-align: center;
    padding: 20px 0;
}

.success-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--success-bg);
    color: var(--success);
    border-radius: 50%;
    font-size: 24px;
    margin-bottom: 16px;
}

.success-message p {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 20px;
}

.mfa-step {
    text-align: center;
    padding: 20px 0;
}

.mfa-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.mfa-title {
    font-size: 20px;
    color: var(--text-primary);
    margin-bottom: 8px;
}

.mfa-desc {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 24px;
}

.mfa-step .form-group {
    text-align: left;
}

.mfa-input {
    text-align: center;
    font-size: 24px;
    letter-spacing: 8px;
    padding: 12px;
}

.mfa-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
}

.mfa-actions .btn {
    flex: 1;
}

.mfa-help {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-light);
}

@media (max-width: 480px) {
    .login-container {
        padding: 24px;
    }
}
</style>
