# IxStats Country/Account Setup Flow

## Overview

The IxStats application now includes a comprehensive setup flow that guides new users through linking their account to an existing country or creating a new country profile after their first authentication.

## Flow Description

### 1. Authentication
- Users authenticate using Clerk (Discord OAuth2)
- After successful authentication, users are redirected to the dashboard

### 2. Setup Check
- The `SetupRedirect` component automatically checks if the user has completed setup
- If no country is linked to the user's account, they are redirected to `/setup`

### 3. Setup Options
Users are presented with two options:

#### Option A: Link Existing Country
- Search through existing countries in the system
- Filter by name, continent, or region
- View country details including economic tier and population
- Link their account to the selected country

#### Option B: Create New Country
- Start with a guided country creation process
- System automatically generates realistic economic data
- Creates initial historical data points
- Links the new country to the user's account

### 4. Completion
- After successful setup, users are redirected to their country page
- The setup is marked as complete and users can access all features

## Technical Implementation

### Components

#### SetupRedirect (`src/app/_components/SetupRedirect.tsx`)
- Client component that runs on every page
- Checks user profile for linked country
- Automatically redirects to `/setup` if no country is found
- Skips redirect for setup-related pages

#### Setup Page (`src/app/setup/page.tsx`)
- Multi-step setup wizard
- Handles both linking existing countries and creating new ones
- Includes error handling and loading states
- Uses TRPC for API calls

### API Endpoints

#### Users Router (`src/server/api/routers/users.ts`)
- `getProfile`: Get user profile with linked country
- `linkCountry`: Link user to existing country
- `createCountry`: Create new country for user
- `unlinkCountry`: Unlink country from user
- `getLinkedCountry`: Get user's linked country with full details
- `updateProfile`: Update user profile settings

### Database Schema

The setup flow uses the existing Country table with a `userId` field to track which user is linked to which country.

### Authentication Integration

- Uses Clerk for authentication
- User ID from Clerk is used to link countries
- Setup redirects are integrated into the main layout

## User Experience

### First-Time Users
1. Sign in with Discord
2. Automatically redirected to setup page
3. Choose to link existing or create new country
4. Complete setup and access their country dashboard

### Returning Users
1. Sign in with Discord
2. Automatically redirected to their linked country page
3. Access all features immediately

### Error Handling
- Clear error messages for failed operations
- Loading states during API calls
- Graceful fallbacks if setup fails

## Configuration

The setup flow is automatically enabled and requires no additional configuration. The system:

- Automatically detects new users
- Redirects to setup when needed
- Handles all edge cases gracefully
- Provides a smooth onboarding experience

## Future Enhancements

Potential improvements to the setup flow:

1. **Guided Country Creation**: More detailed country builder with step-by-step configuration
2. **Country Templates**: Pre-built country templates for common scenarios
3. **Import Options**: Allow importing country data from external sources
4. **Setup Progress**: Track setup completion percentage
5. **Tutorial Integration**: Include interactive tutorials during setup 