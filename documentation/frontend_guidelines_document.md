# Frontend Guidelines Document

This document outlines how to build a clear, maintainable, and performant web interface on top of the `veo-3-vertical-project` API. It covers architecture, design principles, styling, component structure, state management, routing, performance, testing, and how everything ties back to the project’s goals.

## 1. Frontend Architecture

### Frameworks and Libraries
- **React (v18+) with TypeScript:** A component-based library that offers type safety and great DX.  
- **Vite:** Fast, lightweight build tool and dev server.  
- **React Router v6:** For declarative client-side routing.  
- **React Query (TanStack Query):** For fetching, caching, and updating server data.  
- **Axios:** Promise-based HTTP client for API calls.  
- **Tailwind CSS:** Utility-first CSS framework for rapid styling.  
- **ESLint & Prettier:** Code linting and formatting.  
- **Jest & React Testing Library:** Unit and integration tests.  
- **Cypress:** End-to-end testing.

### How It Supports Scalability, Maintainability & Performance
- **Component-Based Structure:** Break UI into small, reusable pieces. Easy to maintain and extend.  
- **Type Safety:** TypeScript catches errors early and documents data shapes (e.g., job status objects).  
- **Code Splitting:** Lazy-load routes and large components to reduce initial bundle size.  
- **Static Assets & CSS Tree-Shaking:** Vite and Tailwind purge unused CSS, keeping bundles lean.  
- **API Caching & Background Updates:** React Query reduces network calls and keeps UI in sync efficiently.

## 2. Design Principles

### Key Principles
1. **Usability:** Clear workflows for generating data, uploading files, exporting results, and checking job status.  
2. **Accessibility:** Follow WCAG 2.1 guidelines—semantic HTML, ARIA attributes, keyboard navigation, sufficient contrast.  
3. **Responsiveness:** Fluid layouts that adapt from mobile to desktop seamlessly.  
4. **Consistency:** Uniform spacing, typography, color usage, and component behavior across the app.

### Applying the Principles
- **Form Feedback:** Real-time validation messages on parameters form.  
- **Visual Hierarchy:** Clear call-to-action buttons for “Start Job,” “Upload File,” “Export Data.”  
- **Error States:** Inline error banners, focus on the first invalid field, and clear retry options.  
- **Mobile-First Layouts:** Stack forms and lists on small screens, add sidebars or multi-column layouts on wider viewports.

## 3. Styling and Theming

### Styling Approach
- **Tailwind CSS:** Utility classes keep styles co-located with markup.  
- **Configuration File:** `tailwind.config.js` defines custom colors, breakpoints, and plugins (e.g., `@tailwindcss/forms`).  
- **CSS Layers:** Use `@layer base`, `components`, and `utilities` for organized overrides.

### Theming
- Centralize theme values in Tailwind config: colors, shadows, border radii.  
- Support light/dark mode via the `media` or `class` strategy in Tailwind.  
- Use CSS variables for dynamic theming if needed (e.g., user-selected color accents).

### Visual Style
- **Style Language:** Modern flat design with subtle glassmorphism panels for key sections (backdrop blur + semi-transparent backgrounds).  
- **Glassmorphism Example:**  
  ```html
  <div class="bg-white/30 backdrop-blur-lg rounded-xl p-6 shadow-lg">
    ...
  </div>
  ```

### Color Palette
| Name       | Hex       | Usage                   |
| ---------- | --------- | ----------------------- |
| Primary    | #3B82F6   | Buttons, links          |
| Secondary  | #6366F1   | Highlights, badges      |
| Accent     | #10B981   | Success states, accents |
| Warning    | #F59E0B   | Warnings, alerts        |
| Danger     | #EF4444   | Error messages          |
| Background | #F3F4F6   | Page background         |
| Surface    | #FFFFFF   | Cards, panels           |
| Text High  | #111827   | Primary text            |
| Text Low   | #6B7280   | Secondary text          |

### Typography
- **Font Family:** ‘Inter’, sans-serif—clean, readable, great for UIs.  
- **Sizing Scale:** Use a modular scale (text-sm, text-base, text-lg, text-xl).  
- **Line Heights & Spacing:** Tailwind defaults ensure good readability.

## 4. Component Structure

### Folder Organization (Feature-Based)
```
/src
  /api            # API client and hooks (axios, react-query )
  /components     # Shared UI (buttons, inputs, cards)
  /features       # Page-level features:
    /generate     # Generate data pages and components
    /upload       # File upload pages
    /export       # Export pages
    /status       # Job status pages
  /layouts        # Layout wrappers (header, sidebar, footer)
  /routes         # Route definitions and guards
  /styles         # Tailwind config, globals, variables
  /utils          # Helper functions and constants
```

### Reusability & Maintainability
- **Atomic Components:** Build small “atom” components (Button, InputField), compose into “molecules” (FormGroup), then “organisms” (JobForm).  
- **Clear Props & Types:** Every component has a well-defined interface.  
- **Documentation & Storybook (optional):** Catalog components for easy reference and reuse.

## 5. State Management

### Server State
- **React Query:** Fetch and cache data (job list, job detail).  
- Automatic retries, background refetch, and pagination.

### Client/UI State
- **React Context + useReducer:** Manage global UI concerns (theme toggler, sidebar open state).  
- **Local State (useState):** Form input values, temporary flags.

### Why This Approach?
- **Separation of Concerns:** Server data logic isolated in React Query hooks; UI state in context or local hooks.  
- **Predictability & Debugging:** Devtools for React Query and React Devtools for context.

## 6. Routing and Navigation

- **React Router v6:**  
  - Define nested routes in `routes/AppRoutes.tsx`.  
  - Use `<Outlet />` for nested views.  
  - Protect routes if authentication is added later.

- **Navigation Structure**
  - `/` → Health Check Dashboard  
  - `/generate` → Data Generation Form & Job Summary  
  - `/upload` → File Upload Interface  
  - `/export` → Export Request Form  
  - `/status/:jobId` → Job Status & Download Link

- **Linking & Accessibility**
  - Use `<NavLink>` for active styles.  
  - Ensure landmarks (`<nav>`, `<main>`) and skip links for keyboard users.

## 7. Performance Optimization

- **Lazy Loading:**  
  - React.lazy + Suspense for heavy components or entire feature modules.  
- **Code Splitting at Route Level:** Each page bundle loads only what it needs.  
- **Image & Asset Optimization:** Use SVG icons or optimized raster images.  
- **Tailwind Purge:** Strip unused classes in production build.  
- **Memoization:** `React.memo`, `useMemo`, `useCallback` for expensive calculations.  
- **Prefetching:** React Query’s `prefetchQuery` to warm data before navigation.

## 8. Testing and Quality Assurance

### Unit & Integration Tests
- **Jest + React Testing Library:**  
  - Test components render with right props and user interactions.  
  - Mock API calls via `msw` (Mock Service Worker) for integration tests.

### End-to-End Tests
- **Cypress:**  
  - Write flows for Generate → Status, Upload → Status, Export → Download.  
  - Run in CI on every PR.

### Accessibility Testing
- **axe-core with jest-axe:** Unit tests for accessibility rules.  
- **Lighthouse Audits:** Check performance, accessibility, best practices.

### Linting & Formatting
- **ESLint (with TypeScript plugin):** Enforce code style and catch errors.  
- **Prettier:** Auto-format on save or pre-commit.

## 9. Conclusion and Overall Frontend Summary

These guidelines establish a solid foundation for a web interface that interacts with the `veo-3-vertical-project` API. By choosing a modern React + TypeScript stack, utility-first styling, and best practices in accessibility, performance, and testing, we ensure:

- A maintainable codebase that scales as features grow (e.g., dashboards, authentication).  
- A user-friendly UI that guides users through data generation, file uploads, exports, and tracking job status.  
- A performant and resilient experience, thanks to lazy loading, caching, and robust error handling.  

Following these principles will make it easy for any developer or designer—even without a deep technical background—to understand, contribute to, and extend the frontend in alignment with the project’s goals.