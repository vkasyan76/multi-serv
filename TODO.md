# TODO

Current tasks and improvements for Multi-Serv project.

## High Priority

- [ ] Fix Clerk middleware detection errors
  - File: `src/middleware.ts`
  - Error: "Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()"
  - Related: Dehydrated query rejection errors in terminal

- [ ] Add input validation to tRPC procedures
  - Files: `src/modules/auth/server/procedures.ts`, `src/modules/tenants/server/procedures.ts`
  - Issue: Missing Zod validation for input schemas
  - Priority: Security vulnerability identified by CodeRabbit

- [ ] Complete tenant filtering system integration
  - Files: `src/modules/tenants/ui/components/tenant-list.tsx`
  - Missing: Filter integration with URL state
  - Status: UI components created, backend ready

- [ ] Implement clear button functionality for filters
  - File: `src/modules/tenants/ui/components/tenant-filters.tsx`
  - Status: Button exists but needs onClick handler
  - Related: URL state management with nuqs

- [ ] Fix dehydrated query rejection errors
  - Files: `src/app/(app)/(home)/[category]/page.tsx`, `src/app/(app)/(home)/[category]/[subcategory]/page.tsx`
  - Error: "A query that was dehydrated as pending ended up rejecting"
  - Related: Clerk middleware issues

- [ ] EU-Wide Availability Planning
  - [ ] GDPR Compliance for location data collection
    - Add privacy policy for IP geolocation
    - Implement data retention policies
    - Add user consent for location tracking
  - [ ] Multi-language Support
    - German (de), French (fr), Spanish (es), Italian (it), Dutch (nl)
    - Implement i18n with next-intl or react-i18next
  - [ ] Multi-currency Support
    - Euro (EUR) as primary, support for local currencies
    - Dynamic currency conversion for pricing
  - [ ] Regional Content & Services
    - Country-specific tenant categories
    - Regional service providers
    - Local business regulations compliance

## Medium Priority

- [ ] Modularize large procedures into smaller functions
  - Files: `src/modules/auth/server/procedures.ts`, `src/modules/tenants/server/procedures.ts`
  - Target: Break down complex procedures for better maintainability
  - Add: JSDoc documentation for complex functions

- [ ] Add database indexes for frequently queried fields
  - Files: `src/collections/Tenants.ts`, `src/collections/Users.ts`
  - Fields: `category`, `subcategory`, `hourlyRate`, `email`
  - Impact: Performance optimization for tenant queries

- [ ] Add loading states for async operations
  - Files: `src/modules/tenants/ui/components/tenant-list.tsx`
  - Component: `src/components/shared/loading.tsx` (already exists)
  - Target: All data fetching operations

- [ ] Implement proper error boundaries
  - Files: `src/app/(app)/(home)/[category]/page.tsx`, `src/app/(app)/(home)/[category]/[subcategory]/page.tsx`
  - Component: `src/components/shared/not-found.tsx` (already exists)
  - Target: Graceful error handling for failed queries

- [ ] Add form validation feedback
  - Files: `src/modules/profile/ui/GeneralProfileForm.tsx`, `src/modules/profile/ui/VendorProfileForm.tsx`
  - Target: Real-time validation feedback
  - Related: React Hook Form integration

## Low Priority

- [ ] Add API documentation
  - Files: `src/modules/*/server/procedures.ts`
  - Target: JSDoc comments for all tRPC procedures
  - Format: OpenAPI/Swagger compatible

- [ ] Create deployment guide
  - File: `README.md` (already has basic deployment info)
  - Target: Step-by-step Vercel deployment guide
  - Include: Environment variable setup

- [ ] Add unit tests for critical business logic
  - Files: `src/modules/auth/server/procedures.ts`, `src/modules/tenants/server/procedures.ts`
  - Framework: Jest + React Testing Library
  - Target: Core business logic validation

- [ ] Implement integration tests
  - Files: `src/app/(app)/(home)/[category]/page.tsx`
  - Framework: Playwright or Cypress
  - Target: End-to-end user flows

## DONE

- [x] Tenant filtering system with URL state management
  - Files: `src/modules/tenants/hooks/use-tenant-filters.ts`, `src/app/(app)/(home)/layout.tsx`
  - Package: `nuqs` for URL parameter handling

- [x] Price filter components with currency formatting
  - Files: `src/modules/tenants/ui/components/price-filter.tsx`
  - Integration: `src/modules/profile/location-utils.ts` for currency formatting

- [x] Page layouts with filter integration
  - Files: `src/app/(app)/(home)/[category]/page.tsx`, `src/app/(app)/(home)/[category]/[subcategory]/page.tsx`
  - Components: `src/modules/tenants/ui/components/tenant-filters.tsx`

- [x] nuqs package for URL parameter handling
  - Package: `nuqs` added to dependencies
  - Integration: `NuqsAdapter` in layout

- [x] tRPC procedures supporting min/max price filtering
  - Files: `src/modules/tenants/server/procedures.ts`
  - Database: MongoDB query with `greater_than_equal` and `less_than_equal` 