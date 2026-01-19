import { terms as staticTerms, deliverables as staticDeliverables } from './data.js'

// ============================================
// Config
// ============================================

const SHAREPOINT_URL = 'https://aimedu-my.sharepoint.com/personal/jmanipon_emba2027a_aim_edu/_layouts/15/download.aspx?share=IQCNcqLzW5u5RqZGwq8nlB6zAU_7vilFDN4YericEr0VlVQ'

// ============================================
// State
// ============================================

let terms = staticTerms
let allDeliverables = staticDeliverables
let currentTerm = terms[terms.length - 1]
let deliverables = []
let currentFilter = 'all'
let currentView = 'course'
let searchQuery = ''
let currentWeekFilter = 'all'

// ============================================
// DOM Elements
// ============================================

const elements = {
    termSelect: document.getElementById('termSelect'),
    loading: document.getElementById('loading'),
    deliverablesList: document.getElementById('deliverablesList'),
    courseFilters: document.getElementById('courseFilters'),
    weekFilters: document.getElementById('weekFilters'),
    courseGroups: document.getElementById('courseGroups'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    notifyToggle: document.getElementById('notifyToggle'),
    searchInput: document.getElementById('searchInput'),
    viewToggle: document.querySelector('.view-toggle'),
    statTotal: document.getElementById('statTotal'),
    statUpcoming: document.getElementById('statUpcoming'),
    statDueSoon: document.getElementById('statDueSoon'),
    statOverdue: document.getElementById('statOverdue'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
}

// ============================================
// Excel Fetching and Parsing
// ============================================

async function fetchAndParseExcel() {
    try {
        const url = `${SHAREPOINT_URL}&t=${Date.now()}`
        const response = await fetch(url, { cache: 'no-store' })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })

        const parsedDeliverables = {}
        const parsedTerms = []

        workbook.SheetNames.forEach((sheetName, index) => {
            const termId = `term${index + 1}`
            const termName = sheetName.trim()

            parsedTerms.push({
                id: termId,
                name: termName,
                startDate: null,
                endDate: null,
            })

            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

            parsedDeliverables[termId] = parseSheetData(jsonData, termId)
        })

        return { terms: parsedTerms, deliverables: parsedDeliverables }
    } catch (error) {
        console.warn('Failed to fetch Excel, using static data:', error.message)
        return null
    }
}

function parseSheetData(rows, termId) {
    if (rows.length < 2) return []

    const headers = rows[0].map(h => String(h || '').toLowerCase().trim())

    // Find column indices
    const colMap = {
        status: headers.findIndex(h => h.includes('status')),
        week: headers.findIndex(h => h.includes('week')),
        dueDate: headers.findIndex(h => h.includes('due date') || h.includes('date')),
        dueTime: headers.findIndex(h => h.includes('time')),
        courseCode: headers.findIndex(h => h.includes('course code') || h.includes('code')),
        title: headers.findIndex(h => h.includes('deliverable') || h.includes('title')),
        courseName: headers.findIndex(h => h.includes('course') && !h.includes('code')),
        type: headers.findIndex(h => h.includes('type')),
        notes: headers.findIndex(h => h.includes('note')),
    }

    const deliverables = []
    let id = 1

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        const courseCode = colMap.courseCode >= 0 ? String(row[colMap.courseCode] || '').trim() : ''
        const title = colMap.title >= 0 ? String(row[colMap.title] || '').trim() : ''

        if (!courseCode || !title) continue

        const week = colMap.week >= 0 ? parseInt(row[colMap.week]) || 1 : 1
        const courseName = colMap.courseName >= 0 ? String(row[colMap.courseName] || '').trim() : courseCode
        const type = colMap.type >= 0 ? String(row[colMap.type] || '').trim() : ''
        const notes = colMap.notes >= 0 ? String(row[colMap.notes] || '').trim() : ''

        // Parse date and time
        let dueDate = null
        if (colMap.dueDate >= 0 && row[colMap.dueDate]) {
            dueDate = parseExcelDate(row[colMap.dueDate], colMap.dueTime >= 0 ? row[colMap.dueTime] : null)
        }

        // Build description
        let description = ''
        if (dueDate) {
            description = `Due: ${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            if (colMap.dueTime >= 0 && row[colMap.dueTime]) {
                description += ` at ${formatTime(row[colMap.dueTime])}`
            }
        }
        if (type) description += ` | ${type}`
        if (notes) description += ` | ${notes}`

        deliverables.push({
            id: id++,
            courseCode,
            courseName,
            title,
            dueDate: dueDate ? dueDate.toISOString() : null,
            description: description || 'No details',
            week,
        })
    }

    return deliverables
}

function parseExcelDate(dateValue, timeValue) {
    let date = null

    // Handle Excel serial date number
    if (typeof dateValue === 'number') {
        date = new Date((dateValue - 25569) * 86400 * 1000)
    } else if (dateValue instanceof Date) {
        date = dateValue
    } else if (typeof dateValue === 'string') {
        date = new Date(dateValue)
    }

    if (!date || isNaN(date.getTime())) return null

    // Add time if provided
    if (timeValue) {
        if (typeof timeValue === 'number') {
            // Excel time as fraction of day
            const totalMinutes = Math.round(timeValue * 24 * 60)
            const hours = Math.floor(totalMinutes / 60)
            const minutes = totalMinutes % 60
            date.setHours(hours, minutes, 0, 0)
        } else if (typeof timeValue === 'string') {
            const timeMatch = timeValue.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
            if (timeMatch) {
                let hours = parseInt(timeMatch[1])
                const minutes = parseInt(timeMatch[2]) || 0
                const ampm = timeMatch[3]
                if (ampm?.toLowerCase() === 'pm' && hours < 12) hours += 12
                if (ampm?.toLowerCase() === 'am' && hours === 12) hours = 0
                date.setHours(hours, minutes, 0, 0)
            }
        }
    }

    return date
}

function formatTime(timeValue) {
    if (typeof timeValue === 'number') {
        const totalMinutes = Math.round(timeValue * 24 * 60)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        const ampm = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
    }
    return String(timeValue)
}

// ============================================
// Initialize
// ============================================

async function init() {
    initDarkMode()
    initNotifications()
    registerServiceWorker()

    // Try to fetch live data
    const liveData = await fetchAndParseExcel()
    if (liveData) {
        terms = liveData.terms
        allDeliverables = liveData.deliverables
        currentTerm = terms[terms.length - 1]
    }

    renderTermSelector()
    loadTermDeliverables(currentTerm.id)

    // Event listeners
    elements.termSelect.addEventListener('change', (e) => {
        const termId = e.target.value
        currentTerm = terms.find(t => t.id === termId)
        currentFilter = 'all'
        currentWeekFilter = 'all'
        loadTermDeliverables(termId)
    })

    elements.downloadAllBtn.addEventListener('click', downloadAllICS)
    elements.darkModeToggle.addEventListener('click', toggleDarkMode)
    elements.notifyToggle.addEventListener('click', toggleNotifications)
    elements.searchInput.addEventListener('input', handleSearch)

    elements.viewToggle.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-btn')) {
            elements.viewToggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentView = e.target.dataset.view
            updateViewState()
            renderDeliverables()
        }
    })

    setInterval(updateCountdowns, 60000)
    setInterval(checkAndNotify, 60000 * 30) // Check every 30 minutes
}

function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode === 'true' || (!savedMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode')
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode')
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'))
}

// ============================================
// PWA & Notifications
// ============================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.warn('Service Worker registration failed:', err))
    }
}

function initNotifications() {
    const enabled = localStorage.getItem('notifications') === 'true'
    if (enabled && Notification.permission === 'granted') {
        elements.notifyToggle.classList.add('notify-active')
    }
}

async function toggleNotifications() {
    const currentlyEnabled = elements.notifyToggle.classList.contains('notify-active')

    if (currentlyEnabled) {
        // Disable notifications
        elements.notifyToggle.classList.remove('notify-active')
        localStorage.setItem('notifications', 'false')
    } else {
        // Ask user first before requesting browser permission
        if (!('Notification' in window)) {
            alert('This browser does not support notifications')
            return
        }

        const userConfirmed = confirm(
            'Enable deadline notifications?\n\n' +
            'You will receive alerts when deliverables are due within 24 hours.\n\n' +
            'Click OK to enable.'
        )

        if (!userConfirmed) return

        let permission = Notification.permission
        if (permission === 'default') {
            permission = await Notification.requestPermission()
        }

        if (permission === 'granted') {
            elements.notifyToggle.classList.add('notify-active')
            localStorage.setItem('notifications', 'true')

            // Send test notification
            new Notification('Notifications Enabled', {
                body: 'You will be notified about upcoming deadlines',
                icon: '/icon-192.png'
            })

            // Check immediately
            checkAndNotify()
        } else {
            alert('Please allow notifications in your browser settings')
        }
    }
}

function checkAndNotify() {
    if (localStorage.getItem('notifications') !== 'true') return
    if (Notification.permission !== 'granted') return

    const now = new Date()
    const notifiedKey = 'notified_' + now.toDateString()
    const notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]')

    deliverables.forEach(d => {
        if (!d.dueDate || notified.includes(d.id)) return

        const diff = d.dueDate - now
        const hours = diff / (1000 * 60 * 60)

        // Notify if due within 24 hours
        if (hours > 0 && hours <= 24) {
            const timeStr = hours < 1
                ? `${Math.round(hours * 60)} minutes`
                : `${Math.round(hours)} hours`

            new Notification(`[${d.courseCode}] Due Soon!`, {
                body: `${d.title} is due in ${timeStr}`,
                icon: '/icon-192.png',
                tag: `deadline-${d.id}`
            })

            notified.push(d.id)
            localStorage.setItem(notifiedKey, JSON.stringify(notified))
        }
    })
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase().trim()
    renderDeliverables()
}

function updateViewState() {
    if (currentView === 'course') {
        elements.courseFilters.classList.remove('hidden')
        elements.weekFilters.classList.add('hidden')
    } else {
        elements.courseFilters.classList.add('hidden')
        elements.weekFilters.classList.remove('hidden')
    }
}

function renderTermSelector() {
    elements.termSelect.innerHTML = terms
        .slice()
        .reverse()
        .map(term => `<option value="${term.id}" ${term.id === currentTerm.id ? 'selected' : ''}>${term.name}</option>`)
        .join('')
}

function loadTermDeliverables(termId) {
    const rawDeliverables = allDeliverables[termId] || []
    deliverables = rawDeliverables.map(d => ({
        ...d,
        dueDate: d.dueDate ? new Date(d.dueDate) : null
    }))

    renderFilters()
    renderWeekFilters()
    updateStats()
    renderDeliverables()
    elements.loading.classList.add('hidden')
    elements.deliverablesList.classList.remove('hidden')
}

// ============================================
// Stats Dashboard
// ============================================

function updateStats() {
    const now = new Date()
    let upcoming = 0
    let dueSoon = 0
    let overdue = 0

    deliverables.forEach(d => {
        if (!d.dueDate) return
        const diff = d.dueDate - now
        const days = diff / (1000 * 60 * 60 * 24)

        if (days < 0) {
            overdue++
        } else if (days < 7) {
            dueSoon++
        } else {
            upcoming++
        }
    })

    elements.statTotal.textContent = deliverables.length
    elements.statUpcoming.textContent = upcoming
    elements.statDueSoon.textContent = dueSoon
    elements.statOverdue.textContent = overdue

    const total = deliverables.filter(d => d.dueDate).length
    const progress = total > 0 ? Math.round((overdue / total) * 100) : 0
    elements.progressFill.style.width = `${progress}%`
    elements.progressText.textContent = `${progress}% of term completed (${overdue} of ${total} deliverables past due)`
}

// ============================================
// Rendering
// ============================================

function renderFilters() {
    const courses = [...new Set(deliverables.map(d => d.courseCode))].sort()

    elements.courseFilters.innerHTML = '<button class="filter-btn active" data-filter="all">All Courses</button>'

    courses.forEach(course => {
        const btn = document.createElement('button')
        btn.className = 'filter-btn'
        if (currentFilter === course) btn.classList.add('active')
        btn.dataset.filter = course
        btn.textContent = course
        elements.courseFilters.appendChild(btn)
    })

    if (currentFilter === 'all') {
        elements.courseFilters.querySelector('[data-filter="all"]').classList.add('active')
    }

    elements.courseFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            elements.courseFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentFilter = e.target.dataset.filter
            renderDeliverables()
        }
    })
}

function renderWeekFilters() {
    const weeks = [...new Set(deliverables.map(d => d.week))].sort((a, b) => a - b)

    elements.weekFilters.innerHTML = '<button class="filter-btn active" data-week="all">All Weeks</button>'

    weeks.forEach(week => {
        const btn = document.createElement('button')
        btn.className = 'filter-btn'
        if (currentWeekFilter === week) btn.classList.add('active')
        btn.dataset.week = week
        btn.textContent = `Week ${week}`
        elements.weekFilters.appendChild(btn)
    })

    if (currentWeekFilter === 'all') {
        elements.weekFilters.querySelector('[data-week="all"]').classList.add('active')
    }

    elements.weekFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            elements.weekFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentWeekFilter = e.target.dataset.week === 'all' ? 'all' : parseInt(e.target.dataset.week)
            renderDeliverables()
        }
    })
}

function getFilteredDeliverables() {
    let filtered = deliverables

    if (searchQuery) {
        filtered = filtered.filter(d =>
            d.title.toLowerCase().includes(searchQuery) ||
            d.courseCode.toLowerCase().includes(searchQuery) ||
            d.courseName.toLowerCase().includes(searchQuery) ||
            (d.description && d.description.toLowerCase().includes(searchQuery))
        )
    }

    if (currentView === 'course') {
        if (currentFilter !== 'all') {
            filtered = filtered.filter(d => d.courseCode === currentFilter)
        }
    } else {
        if (currentWeekFilter !== 'all') {
            filtered = filtered.filter(d => d.week === currentWeekFilter)
        }
    }

    return filtered
}

function renderDeliverables() {
    const filtered = getFilteredDeliverables()

    if (currentView === 'course') {
        renderByCourse(filtered)
    } else {
        renderByWeek(filtered)
    }
}

function renderByCourse(filtered) {
    const grouped = {}
    filtered.forEach(d => {
        if (!grouped[d.courseCode]) grouped[d.courseCode] = []
        grouped[d.courseCode].push(d)
    })

    elements.courseGroups.innerHTML = ''

    if (Object.keys(grouped).length === 0) {
        elements.courseGroups.innerHTML = '<div class="no-results">No deliverables found</div>'
        return
    }

    Object.keys(grouped).sort().forEach(course => {
        const items = grouped[course]
        const courseName = items[0].courseName
        const section = document.createElement('div')
        section.className = 'course-section'

        section.innerHTML = `
            <div class="course-header">
                <div class="course-title">
                    <span class="course-code">${escapeHtml(course)}</span>
                    <span class="course-name">${escapeHtml(courseName)}</span>
                    <span class="course-count">${items.length}</span>
                </div>
                <button class="btn btn-calendar" data-course="${escapeHtml(course)}">
                    Download .ics
                </button>
            </div>
            <div class="course-items">
                ${items.map(item => renderDeliverableItem(item)).join('')}
            </div>
        `

        const header = section.querySelector('.course-header')
        const courseItems = section.querySelector('.course-items')
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-calendar')) {
                courseItems.classList.toggle('hidden')
            }
        })

        const downloadBtn = section.querySelector('.btn-calendar')
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            downloadCourseICS(course)
        })

        elements.courseGroups.appendChild(section)
    })

    attachItemEventListeners()
}

function renderByWeek(filtered) {
    const grouped = {}
    filtered.forEach(d => {
        const week = d.week || 0
        if (!grouped[week]) grouped[week] = []
        grouped[week].push(d)
    })

    elements.courseGroups.innerHTML = ''

    if (Object.keys(grouped).length === 0) {
        elements.courseGroups.innerHTML = '<div class="no-results">No deliverables found</div>'
        return
    }

    Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b)).forEach(week => {
        const items = grouped[week]
        const section = document.createElement('div')
        section.className = 'course-section'

        section.innerHTML = `
            <div class="course-header">
                <div class="course-title">
                    <span class="course-code">Week ${week}</span>
                    <span class="course-name">${items.length} deliverables</span>
                    <span class="course-count">${items.length}</span>
                </div>
            </div>
            <div class="course-items">
                ${items.map(item => renderDeliverableItem(item, true)).join('')}
            </div>
        `

        const header = section.querySelector('.course-header')
        const courseItems = section.querySelector('.course-items')
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-calendar')) {
                courseItems.classList.toggle('hidden')
            }
        })

        elements.courseGroups.appendChild(section)
    })

    attachItemEventListeners()
}

function attachItemEventListeners() {
    document.querySelectorAll('[data-item-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            downloadSingleICS(parseInt(btn.dataset.itemId))
        })
    })
}

function renderDeliverableItem(item, showCourse = false) {
    const status = getStatus(item.dueDate)
    const dateStr = item.dueDate
        ? item.dueDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
        : 'Date TBD'

    const countdown = getCountdown(item.dueDate)

    return `
        <div class="deliverable-item ${status.class}">
            <div class="deliverable-info">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="deliverable-meta">
                    <span class="due-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${dateStr}
                    </span>
                    <span class="status-badge status-${status.class}">${status.label}</span>
                    ${showCourse ? `<span class="course-badge">${escapeHtml(item.courseCode)}</span>` : `<span class="week-badge">Week ${item.week}</span>`}
                </div>
                ${countdown ? `<div class="countdown" data-due="${item.dueDate.toISOString()}">${countdown}</div>` : ''}
            </div>
            <div class="deliverable-actions">
                <button class="btn btn-calendar" data-item-id="${item.id}" title="Add to Calendar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span class="btn-text">Add to Calendar</span>
                </button>
            </div>
        </div>
    `
}

function getCountdown(dueDate) {
    if (!dueDate) return null

    const now = new Date()
    const diff = dueDate - now

    if (diff < 0) return null

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 30) {
        return null
    } else if (days > 0) {
        return `${days}d ${hours}h remaining`
    } else if (hours > 0) {
        return `${hours}h ${minutes}m remaining`
    } else {
        return `${minutes}m remaining`
    }
}

function updateCountdowns() {
    document.querySelectorAll('.countdown[data-due]').forEach(el => {
        const dueDate = new Date(el.dataset.due)
        const countdown = getCountdown(dueDate)
        if (countdown) {
            el.textContent = countdown
        } else {
            el.textContent = ''
        }
    })
}

function getStatus(dueDate) {
    if (!dueDate) return { label: 'TBD', class: 'upcoming' }

    const now = new Date()
    const diff = dueDate - now
    const days = diff / (1000 * 60 * 60 * 24)

    if (days < 0) return { label: 'Past', class: 'overdue' }
    if (days < 1) return { label: 'Today', class: 'soon' }
    if (days < 3) return { label: 'Due soon', class: 'soon' }
    if (days < 7) return { label: 'This week', class: 'soon' }
    return { label: 'Upcoming', class: 'upcoming' }
}

function escapeHtml(str) {
    if (!str) return ''
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
}

// ============================================
// ICS Calendar Generation
// ============================================

function generateICS(items) {
    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const escapeICS = (str) => {
        if (!str) return ''
        return str.replace(/[\\;,\n]/g, match => {
            if (match === '\n') return '\\n'
            return '\\' + match
        })
    }

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EMBA 2027A//Deliverables//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:EMBA 2027A ${currentTerm.name} Deliverables
`

    items.forEach(item => {
        if (!item.dueDate) return

        const uid = `${item.id}-${item.courseCode.replace(/\s/g, '')}-${currentTerm.id}@emba2027a`
        const dtstamp = formatDate(new Date())
        const dtstart = formatDate(item.dueDate)

        ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
SUMMARY:[${escapeICS(item.courseCode)}] ${escapeICS(item.title)}
DESCRIPTION:${escapeICS(item.courseName)}\\n${escapeICS(item.description)}
END:VEVENT
`
    })

    ics += 'END:VCALENDAR'
    return ics
}

function downloadICS(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
}

function downloadSingleICS(id) {
    const item = deliverables.find(d => d.id === id)
    if (!item) return
    const ics = generateICS([item])
    const filename = `${item.courseCode}-${item.title.replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.ics`
    downloadICS(ics, filename)
}

function downloadCourseICS(courseCode) {
    const items = deliverables.filter(d => d.courseCode === courseCode)
    const ics = generateICS(items)
    downloadICS(ics, `${courseCode.replace(/[^a-z0-9]/gi, '-')}-${currentTerm.id}-deliverables.ics`)
}

function downloadAllICS() {
    const ics = generateICS(deliverables)
    downloadICS(ics, `emba2027a-${currentTerm.id}-all-deliverables.ics`)
}

// ============================================
// Start
// ============================================

init()
