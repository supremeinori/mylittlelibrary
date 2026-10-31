# Software Requirements Specification (SRS)
## My Little Library — Personal Book Organizer

**Version:** 1.0  
**Status:** Initial MVP Specification  
**Application type:** Responsive web application

---

## 1. Project Overview

My Little Library is a lightweight web application for organizing a personal book collection in one place. Users can record books, group them by category, manage reading status, and search or filter their collection.

The application is intended for students and independent readers who want a simple way to organize books they own or plan to read, without the complexity of a full library management system.

## 2. Problem Statement

Readers often keep book information across physical shelves, notes, spreadsheets, and digital lists. As a collection grows, it can become difficult to find a particular book, remember which books are waiting to be read, and track which books are currently being read or have been completed.

My Little Library addresses this organizational problem by providing a single, simple interface for recording and managing a personal book collection.

## 3. Project Objectives

- Centralize personal book information in one application.
- Make it easy to add, view, edit, and delete book records.
- Organize books by category and reading status.
- Provide search and filtering to find books quickly.
- Preserve the collection between page reloads without requiring a server or user account.

## 4. Target Users

- **Students:** People organizing academic and personal reading lists.
- **Independent readers:** People who maintain a personal collection or reading backlog.
- **Book collectors:** People who want a lightweight catalog of books they own or plan to read.

Users are expected to prefer a simple interface and not require advanced library circulation, multi-user access, or cloud synchronization.

## 5. Project Scope

### 5.1 In Scope

- Dashboard with book-count summaries.
- Book CRUD (create, read, update, delete).
- Book categories.
- Reading-status management.
- Search by title or author.
- Filtering by category and reading status.
- Local persistence using browser `localStorage`.
- Responsive desktop and mobile layout.
- Sample records for demonstrating the application.

### 5.2 Out of Scope

- User registration and login.
- Backend server or external database.
- Cloud synchronization across devices.
- External book metadata or ISBN API integration.
- AI features embedded in the application.
- Social features, borrowing/return tracking, and multi-user permissions.
- File uploads for book covers.

## 6. Functional Requirements

### FR-01 — Dashboard

- The application shall display the total number of books.
- The application shall display counts for `Want to Read`, `Reading`, and `Finished`.
- Dashboard counts shall reflect the current collection data.

### FR-02 — Book Management

- Users shall be able to add a book.
- Users shall be able to view book details in the collection.
- Users shall be able to edit an existing book.
- Users shall be able to delete a book after confirming the action.
- Each book record shall contain:
  - Title (required)
  - Author (required)
  - Category (required)
  - Reading status (required)
  - Notes (optional)

### FR-03 — Categories

- Users shall be able to assign one category to each book.
- Initial categories shall include `Psychology`, `Philosophy`, `Literature`, `Cinema`, `Technology`, and `Other`.
- The selected category shall be visible on the book card.
- Category selection shall be available when adding or editing a book.

### FR-04 — Reading Status

- Each book shall have one of these statuses:
  - `Want to Read`
  - `Reading`
  - `Finished`
- Users shall be able to change a book's status.
- The interface and dashboard counts shall update after a status change.

### FR-05 — Search and Filtering

- Users shall be able to search by book title or author.
- Users shall be able to filter books by category.
- Users shall be able to filter books by reading status.
- Search and filters shall work together.
- Users shall be able to clear filters and return to the full collection.
- The application shall show an appropriate empty state when no records match.

### FR-06 — Local Data Persistence

- The application shall save book records in browser `localStorage`.
- The application shall restore saved records when reopened in the same browser and origin.
- Create, update, and delete operations shall persist.
- If no saved collection exists, the application may initialize with sample books for demonstration.
- The application shall handle missing or malformed stored data safely where practical.

## 7. Data Requirements

Each book record shall use the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | String | Yes | Unique identifier for the book record |
| `title` | String | Yes | Book title |
| `author` | String | Yes | Author name |
| `category` | String | Yes | Selected book category |
| `status` | String | Yes | Reading status |
| `notes` | String | No | Optional personal note |
| `createdAt` | String | Yes | Record creation timestamp |

The application shall use a stable unique identifier so editing or deleting one book does not accidentally affect another record.

## 8. Non-Functional Requirements

### NFR-01 — Usability
- The interface shall be easy to understand for first-time users.
- Primary actions such as adding a book and searching the collection shall be easy to locate.

### NFR-02 — Responsive Design
- The interface shall adapt to desktop, tablet, and mobile viewport sizes.
- Book cards and form controls shall remain usable on small screens.

### NFR-03 — Performance
- Core interactions shall respond without unnecessary delays for a typical personal collection.
- The application shall not require a build process or dependency installation.

### NFR-04 — Maintainability
- Code shall be separated into `index.html`, `style.css`, and `script.js`.
- Functions and variables shall use clear, consistent names.
- Unnecessary dependencies and duplicated logic shall be avoided.

### NFR-05 — Compatibility
- The application shall support modern browsers with JavaScript and `localStorage` enabled.

### NFR-06 — Input Safety
- Title, author, category, and status shall be validated before saving.
- User-provided text shall be rendered safely to avoid interpreting it as HTML.
- Destructive actions shall require confirmation.

## 9. User Interface Requirements

The application shall include:

1. **Navigation:** A simple sidebar or compact navigation area.
2. **Dashboard summary:** Total books and counts by reading status.
3. **Book collection:** A responsive grid or list of book cards.
4. **Search and filters:** Search input and category/status filters.
5. **Add/edit form:** Fields for title, author, category, status, and optional notes.
6. **Empty states:** Helpful messages when the collection is empty or no search results match.
7. **Delete confirmation:** A clear confirmation before removing a record.

### Visual Direction

- Editorial-inspired personal library aesthetic.
- Warm off-white background.
- Dark burgundy accents and near-black typography.
- Clear typography, restrained borders, and consistent spacing.
- Simple book cards and status labels.
- Avoid excessive gradients, decorative animations, and unnecessary dashboard elements.

## 10. Technical Constraints

- **Frontend:** HTML5, CSS3, vanilla JavaScript.
- **Persistence:** Browser `localStorage`.
- **Required files:** `index.html`, `style.css`, `script.js`.
- No frontend frameworks, CSS frameworks, external libraries, backend, database server, or external APIs.
- The application should run by opening `index.html` in a modern browser.

## 11. Acceptance Criteria

The MVP shall be considered complete when:

1. A user can add a book with valid required fields.
2. A user cannot save a book when the title or author is missing.
3. A user can edit a book and see the updated values.
4. A user can change a book's reading status.
5. Dashboard counts update to match the current data.
6. A user can delete a book after confirming.
7. Search returns matching titles and authors.
8. Category and status filters work individually and together.
9. The collection persists after reloading the page in the same browser and origin.
10. Empty states appear when appropriate.
11. The layout remains usable on desktop and mobile.
12. Core functionality works without installing dependencies or connecting to a server.

## 12. Risks and Limitations

- `localStorage` data is tied to the browser and origin; it does not automatically synchronize between devices.
- Clearing browser site data may remove the saved collection.
- The MVP does not include account recovery, cloud backup, or multi-user support.
- Sample data should be clearly distinguishable from records added by the user, or the application should provide an easy way to remove sample records.

## 13. Future Development

Possible future improvements include:

- Import and export of the book collection.
- Book-cover images.
- ISBN-based book metadata lookup.
- Cloud synchronization and user accounts.
- Reading goals and progress statistics.
- Optional AI-assisted categorization or reading recommendations.

These features are not part of the initial MVP.

## 14. Implementation Note

IBM Bob is used as an AI coding assistant to help generate and refine the application code. Prompt design and iteration records should document the prompts actually used, the issues observed, the changes made, and the results verified during development.
