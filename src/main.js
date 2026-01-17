import { terms, deliverables as allDeliverables } from './data.js'

// ============================================
// State
// ============================================

let currentTerm = terms[terms.length - 1] // Default to latest term
let deliverables = []
let currentFilter = 'all'

// ============================================
// DOM Elements
// ============================================

const elements = {
    termSelect: document.getElementById('termSelect'),
    loading: document.getElementById('loading'),
    deliverablesList: document.getElementById('deliverablesList'),
    courseFilters: document.getElementById('courseFilters'),
    courseGroups: document.getElementById('courseGroups'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
}

// ============================================
// Initialize
// ============================================

function init() {
    // Populate term selector
    renderTermSelector()

    // Load deliverables for current term
    loadTermDeliverables(currentTerm.id)

    // Event listeners
    elements.termSelect.addEventListener('change', (e) => {
        const termId = e.target.value
        currentTerm = terms.find(t => t.id === termId)
        currentFilter = 'all'
        loadTermDeliverables(termId)
    })

    elements.downloadAllBtn.addEventListener('click', downloadAllICS)
}

function renderTermSelector() {
    elements.termSelect.innerHTML = terms
        .slice()
        .reverse() // Latest first
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
    renderDeliverables()
    elements.loading.classList.add('hidden')
    elements.deliverablesList.classList.remove('hidden')
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

    // Update active state for All button
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

function renderDeliverables() {
    const filtered = currentFilter === 'all'
        ? deliverables
        : deliverables.filter(d => d.courseCode === currentFilter)

    // Group by course
    const grouped = {}
    filtered.forEach(d => {
        if (!grouped[d.courseCode]) grouped[d.courseCode] = []
        grouped[d.courseCode].push(d)
    })

    elements.courseGroups.innerHTML = ''

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

        // Add event listeners
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

    // Add event listeners for individual item calendar buttons
    document.querySelectorAll('[data-item-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            downloadSingleICS(parseInt(btn.dataset.itemId))
        })
    })
}

function renderDeliverableItem(item) {
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
                    <span class="week-badge">Week ${item.week}</span>
                </div>
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
