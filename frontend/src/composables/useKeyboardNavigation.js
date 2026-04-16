import { ref, onMounted, onUnmounted } from 'vue'

export function useKeyboard(options = {}) {
    const {
        onEscape,
        onEnter,
        onArrowUp,
        onArrowDown,
        onTab,
        onShiftTab,
        enabled = true
    } = options

    const handleKeydown = (e) => {
        if (!enabled) return

        switch (e.key) {
            case 'Escape':
                onEscape?.(e)
                break
            case 'Enter':
                onEnter?.(e)
                break
            case 'ArrowUp':
                e.preventDefault()
                onArrowUp?.(e)
                break
            case 'ArrowDown':
                e.preventDefault()
                onArrowDown?.(e)
                break
            case 'Tab':
                if (e.shiftKey) {
                    onShiftTab?.(e)
                } else {
                    onTab?.(e)
                }
                break
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })
}

export function useFocusTrap(containerRef, options = {}) {
    const { onEscape } = options
    const previousActiveElement = ref(null)

    const getFocusableElements = () => {
        if (!containerRef.value) return []
        
        return containerRef.value.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
            'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    }

    const handleKeydown = (e) => {
        if (!containerRef.value) return

        if (e.key === 'Escape' && onEscape) {
            onEscape()
            return
        }

        if (e.key === 'Tab') {
            const focusable = getFocusableElements()
            if (focusable.length === 0) return

            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    const activate = () => {
        previousActiveElement.value = document.activeElement
        document.addEventListener('keydown', handleKeydown)
        
        const focusable = getFocusableElements()
        if (focusable.length > 0) {
            focusable[0].focus()
        }
    }

    const deactivate = () => {
        document.removeEventListener('keydown', handleKeydown)
        if (previousActiveElement.value) {
            previousActiveElement.value.focus()
        }
    }

    return { activate, deactivate }
}

export function useListNavigation(itemsRef, options = {}) {
    const { 
        onSelect,
        loop = true,
        orientation = 'vertical'
    } = options

    const currentIndex = ref(-1)

    const handleKeydown = (e) => {
        if (!itemsRef.value || itemsRef.value.length === 0) return

        const moveNext = () => {
            if (currentIndex.value < itemsRef.value.length - 1) {
                currentIndex.value++
            } else if (loop) {
                currentIndex.value = 0
            }
        }

        const movePrev = () => {
            if (currentIndex.value > 0) {
                currentIndex.value--
            } else if (loop) {
                currentIndex.value = itemsRef.value.length - 1
            }
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                if (orientation === 'vertical') moveNext()
                break
            case 'ArrowUp':
                e.preventDefault()
                if (orientation === 'vertical') movePrev()
                break
            case 'ArrowRight':
                e.preventDefault()
                if (orientation === 'horizontal') moveNext()
                break
            case 'ArrowLeft':
                e.preventDefault()
                if (orientation === 'horizontal') movePrev()
                break
            case 'Home':
                e.preventDefault()
                currentIndex.value = 0
                break
            case 'End':
                e.preventDefault()
                currentIndex.value = itemsRef.value.length - 1
                break
            case 'Enter':
            case ' ':
                e.preventDefault()
                if (currentIndex.value >= 0 && currentIndex.value < itemsRef.value.length) {
                    onSelect?.(itemsRef.value[currentIndex.value], currentIndex.value)
                }
                break
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })

    return {
        currentIndex,
        setIndex: (index) => { currentIndex.value = index },
        reset: () => { currentIndex.value = -1 }
    }
}

export function useAnnounce() {
    const announce = (message, priority = 'polite') => {
        const announcer = document.createElement('div')
        announcer.setAttribute('aria-live', priority)
        announcer.setAttribute('aria-atomic', 'true')
        announcer.className = 'sr-only'
        announcer.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);'
        
        document.body.appendChild(announcer)
        
        setTimeout(() => {
            announcer.textContent = message
        }, 50)
        
        setTimeout(() => {
            document.body.removeChild(announcer)
        }, 1000)
    }

    const announcePolite = (message) => announce(message, 'polite')
    const announceAssertive = (message) => announce(message, 'assertive')

    return { announce, announcePolite, announceAssertive }
}
