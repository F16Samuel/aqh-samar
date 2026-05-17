<lovable_prompt>
  <project>
    Build a production-grade full-stack frontend web application for an Employee Goal Setting & Tracking Portal based STRICTLY on the attached PRD and API documentation.

    The frontend MUST map 1:1 with backend APIs.
    DO NOT hardcode:
    - API URLs
    - Mock data
    - Role values
    - User IDs
    - Cycle IDs
    - Goal IDs
    - Department IDs
    - Status values unless returned by backend
    - Authentication tokens

    Everything must come dynamically from backend APIs or environment variables.

    Use:
    - React + TypeScript
    - Vite
    - TailwindCSS
    - React Query (TanStack Query)
    - Axios
    - React Hook Form
    - Zod validation
    - Zustand or Context API for auth/session state
    - Modular scalable architecture
    - Responsive enterprise dashboard UI
    - Clean folder structure
    - API service abstraction layer
    - Strict TypeScript typing
    - Proper loading/error/empty states
    - Toast notifications
    - Role-based routing and rendering
  </project>

  <critical_requirements>
    - FRONTEND MUST FOLLOW THE ATTACHED PRD EXACTLY
    - FRONTEND MUST FOLLOW THE ATTACHED API DOCUMENTATION EXACTLY
    - NO HARDCODED VALUES
    - ALL API ENDPOINTS MUST BE CONFIG DRIVEN
    - USE ENV VARIABLES FOR:
      VITE_API_BASE_URL
      VITE_SUPABASE_URL
      VITE_SUPABASE_ANON_KEY

    - ALL REQUESTS MUST USE:
      Authorization: Bearer JWT

    - JWT TOKEN MUST BE RETRIEVED FROM AUTH STATE
    - CREATE CENTRALIZED AXIOS CLIENT
    - IMPLEMENT REQUEST/RESPONSE INTERCEPTORS
    - IMPLEMENT GLOBAL ERROR HANDLING
    - IMPLEMENT QUERY INVALIDATION AFTER MUTATIONS
    - IMPLEMENT PROPER CACHE STRATEGY
    - IMPLEMENT SKELETON LOADERS
    - IMPLEMENT ACCESS CONTROL
    - IMPLEMENT FORM VALIDATIONS MATCHING BACKEND RULES
  </critical_requirements>

  <additional_ui_ux_directive>

    <enterprise_visual_design>
        The application MUST visually feel like:
        - enterprise performance management software
        - OKR management platforms
        - modern HR analytics dashboards
        - professional SaaS admin systems

        Inspiration:
        - Workday
        - Rippling
        - Jira dashboards
        - Linear
        - Asana reporting
        - ClickUp analytics
        - Microsoft Viva Goals
        - Lattice
        - CultureAmp

        The UI must NOT feel:
        - hackathon-level
        - template-generated
        - generic CRUD
        - plain forms only
    </enterprise_visual_design>

    <analytics_and_visualizations>

        Use professional data visualizations across dashboards.

        REQUIRED VISUAL COMPONENTS:
        - Circular progress trackers
        - Radial progress indicators
        - KPI metric cards
        - Goal completion donuts
        - Quarterly progress charts
        - Team achievement bar charts
        - Department-wise heatmaps
        - Completion trend line charts
        - Goal distribution pie charts
        - Stacked progress bars
        - Performance trend graphs
        - Timeline progress trackers
        - Status segmentation charts
        - Progress gauges
        - Activity timelines

        Use:
        - Recharts
        OR
        - Tremor
        OR
        - ECharts

        Charts MUST:
        - be responsive
        - have loading skeletons
        - support empty states
        - support dark/light themes if implemented
        - use dynamic backend data only
        - never use hardcoded datasets
    </analytics_and_visualizations>

    <dashboard_requirements>

        Employee Dashboard MUST include:
        - Overall annual completion radial
        - Goal weightage distribution
        - Quarterly achievement trends
        - Goal status segmentation
        - Active cycle tracker
        - Personal KPI summary cards
        - Recent activity timeline

        Manager Dashboard MUST include:
        - Team completion analytics
        - Approval pending widgets
        - Team performance heatmap
        - Department progress bars
        - Quarterly comparison charts
        - Team-wise completion donuts
        - Check-in completion tracker

        Admin Dashboard MUST include:
        - Org-wide completion analytics
        - Department comparison charts
        - Escalation monitoring panels
        - Cycle participation metrics
        - Reporting overview analytics
        - System-wide KPI dashboards
        - Role distribution charts
        - Audit activity timeline
    </dashboard_requirements>

    <professional_interactions>

        Add:
        - animated progress transitions
        - hover states
        - micro-interactions
        - smooth loading states
        - sticky analytics headers
        - collapsible sidebars
        - advanced filters
        - searchable tables
        - sortable analytics grids
        - export actions
        - contextual tooltips
        - smart empty states
        - inline editable enterprise tables

        Use:
        - Framer Motion for subtle animations
        - Modern card layouts
        - Consistent spacing system
        - Enterprise typography hierarchy
    </professional_interactions>

    <design_system>

        Use a consistent design system with:
        - spacing tokens
        - typography scale
        - semantic colors
        - reusable chart wrappers
        - reusable stat cards
        - reusable analytics panels
        - reusable data table system
        - reusable modal framework

        Visual hierarchy should prioritize:
        1. KPIs
        2. Progress visibility
        3. Action items
        4. Workflow bottlenecks
        5. Team insights
    </design_system>

    <advanced_features>

        Include:
        - Dynamic analytics driven entirely by backend APIs
        - Real-time status indicators
        - Goal completion forecasting visuals
        - Quarterly progress comparisons
        - Approval workflow visualization
        - Goal lifecycle tracking UI
        - Shared goal relationship indicators
        - Goal lock state visualization
        - Window status indicators for quarterly check-ins

        Add professional indicators such as:
        - warning states
        - blocked states
        - overdue indicators
        - escalation highlights
        - locked goal badges
        - approval workflow chips
    </advanced_features>

    <table_system>

        Enterprise-grade table system required:
        - pagination
        - column sorting
        - filtering
        - row expansion
        - inline editing where permitted
        - sticky headers
        - bulk actions for admin
        - export support
        - responsive behavior

        Tables must visually resemble:
        - Airtable
        - Notion databases
        - Linear issue tables
        - modern admin SaaS dashboards
    </table_system>

    <theme_and_styling>

        Preferred styling:
        - minimal modern enterprise
        - soft shadows
        - rounded cards
        - glassmorphism only if subtle
        - professional spacing
        - premium dashboard feel

        Avoid:
        - excessive gradients
        - neon themes
        - gaming aesthetics
        - cluttered interfaces
        - oversized components
    </theme_and_styling>

  </additional_ui_ux_directive>
  <backend_api_contract>
    Base URL:
    /api/v1

    Authentication:
    - Supabase JWT Authentication
    - Bearer Token based

    Core APIs:
    - /auth/login
    - /auth/me
    - /users
    - /cycles
    - /goal-sheets
    - /goals
    - /achievements
    - /checkins
    - /reports
    - /admin

    Frontend MUST create:
    - typed DTO interfaces
    - request/response schemas
    - reusable API hooks
    - mutation hooks
    - query hooks

    Every API endpoint from the documentation must have:
    - service method
    - query hook
    - mutation hook if applicable
    - loading states
    - optimistic UI where safe
    - error handling
  </backend_api_contract>

  <roles_and_access>
    Implement strict RBAC.

    Roles:
    - employee
    - manager
    - admin

    Employee:
    - Create goal sheets
    - Edit draft goals
    - Submit goals
    - Add quarterly achievements
    - View locked goals
    - View progress

    Manager:
    - Team dashboard
    - Review submitted goals
    - Approve goals
    - Return goals for rework
    - Inline edit targets/weightages during review
    - Add check-in comments
    - View employee progress

    Admin:
    - Manage cycles
    - Unlock goals
    - Push shared goals
    - View escalations
    - View reporting dashboards
    - View audit/governance views
  </roles_and_access>

  <application_modules>

    <module name="Authentication">
      Features:
      - Login flow
      - Session persistence
      - Protected routes
      - Auto token refresh if applicable
      - Auth bootstrap from /auth/me
      - Logout flow

      Requirements:
      - Redirect unauthenticated users
      - Persist user profile
      - Role-based navigation rendering
    </module>

    <module name="Dashboard">
      Build separate dashboards per role.

      Employee Dashboard:
      - Active cycle
      - Goal sheet status
      - Quarterly progress
      - Achievement completion
      - Recent updates

      Manager Dashboard:
      - Team goal approvals
      - Pending reviews
      - Team check-ins
      - Progress overview

      Admin Dashboard:
      - Cycle management
      - Completion analytics
      - Escalations
      - Reporting overview
    </module>

    <module name="Goal Sheets">
      Features:
      - Create draft sheet
      - View own sheets
      - Submit sheet
      - Approval workflow
      - Return for rework

      Validation Rules:
      - Total goal weightage = 100%
      - Minimum weightage per goal = 10%
      - Maximum goals = 8

      Requirements:
      - Dynamic validations
      - Realtime total weightage calculation
      - Inline editable tables
      - Status badges
      - Submission confirmation dialogs
    </module>

    <module name="Goals">
      Features:
      - Create goal
      - Update goal
      - Shared goals
      - Locked goals handling

      Goal Fields:
      - thrust_area
      - title
      - description
      - uom_type
      - target
      - weightage

      UoM Types:
      - min
      - max
      - timeline
      - zero

      Requirements:
      - Shared goals title/target readonly
      - Weightage editable for recipients
      - Proper form validation
    </module>

    <module name="Achievements">
      Features:
      - Quarterly updates
      - Achievement logging
      - Status tracking

      Statuses:
      - Not Started
      - On Track
      - Completed

      Requirements:
      - Planned vs Actual views
      - Quarter-aware UI
      - Window restriction handling from backend
      - Proper error display for blocked windows
    </module>

    <module name="Checkins">
      Features:
      - Manager comments
      - Employee progress review
      - Quarterly check-ins

      Requirements:
      - Timeline view
      - Comment history
      - Structured discussion cards
    </module>

    <module name="Reports">
      Features:
      - Achievement report export
      - Completion dashboard
      - Real-time metrics

      Requirements:
      - CSV/XLSX export triggers
      - Filter by cycle
      - Filter by department
      - Charts and analytics
    </module>

    <module name="Admin">
      Features:
      - Goal unlock
      - Escalations
      - Cycle CRUD

      Requirements:
      - Admin-only route guards
      - Audit visibility
      - Exception management UI
    </module>

  </application_modules>

  <frontend_architecture>
    Create enterprise-grade scalable architecture.

    Structure:
    src/
      api/
      services/
      hooks/
      modules/
      pages/
      layouts/
      routes/
      components/
      store/
      types/
      schemas/
      utils/
      constants/
      providers/

    Requirements:
    - Domain-driven organization
    - Shared reusable UI primitives
    - Strict separation of concerns
    - No business logic inside components
  </frontend_architecture>

  <api_layer_requirements>
    Create:
    - axiosClient.ts
    - authService.ts
    - usersService.ts
    - cyclesService.ts
    - goalSheetsService.ts
    - goalsService.ts
    - achievementsService.ts
    - checkinsService.ts
    - reportsService.ts
    - adminService.ts

    Every service must:
    - Use typed request/response models
    - Use centralized error handling
    - Use env base URL
    - Support cancellation
  </api_layer_requirements>

  <react_query_requirements>
    Implement:
    - query keys factory
    - optimistic updates
    - stale time strategy
    - invalidation strategy
    - retry handling
    - suspense-ready hooks if possible
  </react_query_requirements>

  <ui_ux_requirements>
    UI Style:
    - Enterprise SaaS dashboard
    - Clean modern professional design
    - Responsive
    - Accessible
    - Keyboard friendly
    - Minimal but premium

    Components:
    - Sidebar
    - Top navbar
    - Role aware navigation
    - Data tables
    - Analytics cards
    - Progress indicators
    - Approval workflow cards
    - Timeline components
    - Modal system
    - Confirmation dialogs
    - Toast system
    - Skeleton loaders
    - Empty states
    - Error states
  </ui_ux_requirements>

  <validation_rules>
    Frontend validation MUST mirror backend logic:
    - Max 8 goals
    - Min 10% per goal
    - Total = 100%
    - Required fields
    - UUID validation where needed
    - Proper enum validation
  </validation_rules>

  <non_functional_requirements>
    - Production ready code quality
    - No placeholder implementations
    - No fake APIs
    - No mock adapters
    - No hardcoded sample users
    - Fully typed
    - Reusable architecture
    - Maintainable codebase
    - Clean comments where necessary
    - Optimized renders
    - Lazy loaded routes
    - Route based code splitting
  </non_functional_requirements>

  <deliverables>
    Generate:
    - Full frontend application
    - API integration layer
    - Route structure
    - Authentication system
    - Role-based dashboards
    - All CRUD flows
    - Shared reusable components
    - Environment configuration
    - Type definitions
    - Validation schemas
    - React Query hooks
    - Responsive layouts
    - Production-grade folder structure
  </deliverables>

  <important_context>
    Use the attached API documentation as the SINGLE SOURCE OF TRUTH for API contracts.
    Use the attached PRD as the SINGLE SOURCE OF TRUTH for workflows, validation rules, user journeys, and feature requirements.

    The frontend must align EXACTLY with:
    - endpoint names
    - payload structures
    - response structures
    - role permissions
    - workflow logic
    - quarterly check-in flows
    - goal locking behavior
    - shared goal behavior
    - reporting flows

    Absolutely avoid assumptions not present in the documentation.
  </important_context>

  <references>
    API Documentation:
    :contentReference[oaicite:0]{index=0}

    PRD / Problem Statement:
    :contentReference[oaicite:1]{index=1}
  </references>
</lovable_prompt>