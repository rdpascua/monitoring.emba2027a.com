# EMBA 2027A Deliverables Tracker

A mobile-responsive web app to track EMBA deliverables with calendar subscription support.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Features

- Term selector (defaults to latest term)
- Filter by course code
- Mobile-responsive design
- Status badges (upcoming, due soon, past)
- ICS calendar download (single, per-course, or all)

## Project Structure

```
src/
├── index.html    # Main HTML
├── main.js       # App logic
├── style.css     # Styles
└── data.js       # Deliverables data (edit to add new terms)
```

## Adding New Terms

Edit `src/data.js`:

1. Add the term to the `terms` array:
```javascript
export const terms = [
  { id: 'term1', name: 'Term 1', startDate: '2024-09-01', endDate: '2024-11-30' },
  { id: 'term2', name: 'Term 2', startDate: '2024-12-01', endDate: '2025-02-28' },  // NEW
]
```

2. Add deliverables for the new term:
```javascript
export const deliverables = {
  term1: [ ... ],
  term2: [  // NEW
    {
      id: 1,
      courseCode: "COURSE_CODE",
      courseName: "Course Name",
      title: "Assignment Title",
      dueDate: "2025-01-15T18:00:00",
      description: "Submit by January 15 at 6:00PM",
      week: 1
    },
    // ... more deliverables
  ],
}
```

## Deploy to Cloudflare Pages

### Option A: Connect Git Repository (Recommended)

1. Push to GitHub/GitLab
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
3. Connect your repository
4. Configure build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Deploy

### Option B: Direct Deploy

```bash
npm run build
npx wrangler pages deploy dist
```

## Development

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run preview  # Preview production build
```
