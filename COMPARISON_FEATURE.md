# Country Comparison Feature

## Overview

The Country Comparison feature allows users to compare up to 8 countries side-by-side using interactive charts and statistics. This feature is available on both the main Countries page and the Explore page.

## Features

### Modal Interface
- **Add Countries**: Click "Compare Countries" button to open the comparison modal
- **Search & Select**: Search through available countries and add them to comparison
- **Visual Indicators**: Each country gets a unique color for easy identification
- **Loading States**: Shows loading spinners while fetching country data

### Charts & Visualizations
- **Population Chart**: Compare population sizes across countries
- **GDP Chart**: Compare GDP per capita and total GDP
- **Growth Chart**: Compare population and GDP growth rates
- **Scatter Plot**: Visualize relationships between different metrics
- **Radar Chart**: Multi-dimensional comparison across all metrics

### Statistics Summary
- Total population across selected countries
- Combined GDP
- Average GDP per capita
- Country count

### User Experience
- **Toast Notifications**: Success/error messages for user actions
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Error Handling**: Graceful fallback when data loading fails

## Usage

1. **Open Comparison**: Click the "Compare Countries" button in the sort bar
2. **Add Countries**: Use the "Add Country" button to search and select countries
3. **View Charts**: Switch between different chart types to compare metrics
4. **Remove Countries**: Click the X button on country tags to remove them
5. **Clear All**: Use "Clear All" to reset the comparison
6. **View Details**: When one country is selected, click "View Details" to go to the country page

## Technical Implementation

### Components
- `CountryComparisonModal`: Main modal component
- `ComparisonCharts`: Chart visualization component
- `useCountryComparison`: Custom hook for state management

### Data Flow
1. User selects countries from available list
2. System fetches detailed country data via tRPC API
3. Data is processed and displayed in charts
4. Real-time updates as countries are added/removed

### API Integration
- Uses `countries.getByIdWithEconomicData` endpoint
- Fetches comprehensive economic and demographic data
- Handles loading states and error scenarios
- Graceful fallback to basic data if API fails

## Future Enhancements

- **Save Comparisons**: Allow users to save comparison sets
- **Export Data**: Export comparison data to CSV/Excel
- **Historical Comparison**: Compare countries across different time periods
- **Custom Metrics**: Allow users to define custom comparison metrics
- **Sharing**: Share comparison URLs with other users

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- High contrast color schemes
- Responsive design for all screen sizes 