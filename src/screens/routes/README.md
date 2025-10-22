# Route Screens

Screens for managing and viewing saved GPS routes.

## Files

### `SavedRoutesScreen.tsx`
Main route library screen showing all saved GPS routes with:
- Search functionality (by name, description, tags)
- Activity type filtering (All, Running, Cycling, Walking, Hiking)
- Route cards with stats (distance, elevation, times used)
- Best performance display (fastest time/pace)
- Route management actions (rename, delete)
- Empty state for new users
- Pull-to-refresh support

**Features:**
- **Search**: Real-time filtering by route name/description/tags
- **Filters**: Quick activity type switching
- **Stats Summary**: Shows filtered count and active filter
- **Route Cards**: Compact design with key metrics
- **Color-Coded Icons**: Each activity type has distinct color
- **Actions Menu**: Long-press or menu button for rename/delete
- **Best Times**: Trophy badge showing personal records

**Data Flow:**
- Loads routes from RouteStorageService on mount
- Auto-refreshes when routes are modified
- Filters applied client-side (instant results)
- Deletion with confirmation alert
- Rename with native prompt dialog

**UI/UX:**
- Material Design-inspired cards
- Activity-specific color coding (running=red, cycling=blue, etc.)
- Trophy icon for best performance indicator
- Tags displayed as pills below stats
- Empty states for no routes / no results

## Planned Screens

### `RouteDetailScreen.tsx` (Future)
Detailed view of a single route with:
- Interactive map showing full GPS track
- Elevation profile chart
- Complete workout history on this route
- Personal records and achievements
- Start workout on this route button
- Edit route details (name, description, tags)

### `RouteComparisonScreen.tsx` (Future)
Side-by-side comparison of:
- Current workout vs saved route
- Real-time progress overlay
- PR pace comparison
- "Ahead/Behind" indicators
