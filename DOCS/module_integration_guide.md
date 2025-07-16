# Module Integration Implementation Guide
*Adding Advanced SDI & ECI Modules to IxStats*

## 🎯 Module Overview

### **SDI (Sovereign Digital Interface) - 8 Core Modules**
1. **🚨 Crisis Management Center** - Global crisis tracking and response coordination
2. **💹 Economic Intelligence Hub** - Market analysis and trade monitoring  
3. **🤝 Diplomatic Relations Matrix** - International relationships and treaties
4. **🛡️ Strategic Threat Assessment** - Security analysis and risk evaluation
5. **📅 Global Events Calendar** - International schedule and event coordination
6. **🚢 Trade & Commerce Monitor** - Global commerce and supply chain intelligence
7. **🔬 Technology Transfer Monitoring** - Innovation tracking and tech intelligence
8. **⚡ Resource & Energy Command** - Global resource availability and energy security

### **ECI (Executive Command Interface) - 12 Core Modules**
1. **🎯 Strategic Planning Center** - Long-term national planning and scenario modeling
2. **🚨 Crisis Response Command** - National emergency management
3. **🕵️ Intelligence Operations** - National intelligence services and covert ops
4. **⛏️ Resource Management Hub** - National resource management and strategic reserves
5. **🏗️ Infrastructure Command** - National infrastructure development
6. **🛡️ Defense & Security Center** - Military and homeland security
7. **🎭 Cultural & Education Ministry** - Cultural policy and education systems
8. **🔬 Science & Technology Division** - National R&D and innovation policy
9. **🌍 Environmental Management** - Climate policy and sustainability
10. **🛂 Border & Immigration Control** - Border security and immigration policy
11. **📺 Public Relations & Media** - National communications and public information
12. **🎭 Special Operations Center** - Classified operations and special missions

---

## 🏗️ Implementation Architecture

### **Step 1: Module File Structure**

```
src/
├── app/
│   ├── sdi/
│   │   ├── modules/
│   │   │   ├── crisis-management/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── CrisisTracker.tsx
│   │   │   │   │   ├── ResponseCoordination.tsx
│   │   │   │   │   └── PredictiveAnalysis.tsx
│   │   │   │   └── api/
│   │   │   ├── economic-intelligence/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── CommodityTracker.tsx
│   │   │   │   │   ├── MarketAnalysis.tsx
│   │   │   │   │   └── SanctionsMonitor.tsx
│   │   │   │   └── api/
│   │   │   ├── diplomatic-matrix/
│   │   │   ├── threat-assessment/
│   │   │   ├── global-events/
│   │   │   ├── trade-monitor/
│   │   │   ├── tech-transfer/
│   │   │   └── resource-command/
│   │   └── layout.tsx
│   └── eci/
│       ├── modules/
│       │   ├── strategic-planning/
│       │   │   ├── page.tsx
│       │   │   ├── components/
│       │   │   │   ├── ProjectTracker.tsx
│       │   │   │   ├── ScenarioModeling.tsx
│       │   │   │   └── GoalTracking.tsx
│       │   │   └── api/
│       │   ├── crisis-response/
│       │   ├── intelligence-ops/
│       │   ├── resource-management/
│       │   ├── infrastructure/
│       │   ├── defense-security/
│       │   ├── cultural-education/
│       │   ├── science-tech/
│       │   ├── environmental/
│       │   ├── border-control/
│       │   ├── public-relations/
│       │   └── special-operations/
│       └── layout.tsx
├── components/
│   ├── modules/
│   │   ├── shared/
│   │   │   ├── ModuleCard.tsx
│   │   │   ├── ModuleHeader.tsx
│   │   │   └── ModuleNavigation.tsx
│   │   ├── sdi/
│   │   │   ├── CrisisManagement/
│   │   │   ├── EconomicIntelligence/
│   │   │   └── [other SDI modules]/
│   │   └── eci/
│   │       ├── StrategicPlanning/
│   │       ├── IntelligenceOps/
│   │       └── [other ECI modules]/
│   └── ui/
└── server/
    └── api/
        └── routers/
            ├── sdi/
            │   ├── crisis.ts
            │   ├── economic-intel.ts
            │   ├── diplomatic.ts
            │   └── [other SDI routers]
            └── eci/
                ├── strategic.ts
                ├── intelligence.ts
                ├── resources.ts
                └── [other ECI routers]
```

### **Step 2: Module Base Components**

```tsx
// components/modules/shared/ModuleCard.tsx
interface ModuleCardProps {
  id: string;
  name: string;
  icon: string;
  status: string;
  alerts?: number;
  progress?: number;
  selected: boolean;
  onClick: () => void;
  variant: 'sdi' | 'eci';
}

export function ModuleCard({ 
  id, name, icon, status, alerts, progress, selected, onClick, variant 
}: ModuleCardProps) {
  const variantStyles = {
    sdi: 'border-blue-500/50 bg-blue-500/10',
    eci: 'border-orange-500/50 bg-orange-500/10'
  };

  return (
    <CardSpotlight 
      className={`cursor-pointer transition-all duration-300 ${
        selected ? variantStyles[variant] : ''
      }`}
      focused={selected}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <span className="text-2xl block mb-2">{icon}</span>
        <h3 className="font-bold text-sm mb-2">{name}</h3>
        
        {/* Status Badge */}
        <ModuleStatusBadge status={status} variant={variant} />
        
        {/* Progress Bar for ECI */}
        {variant === 'eci' && progress !== undefined && (
          <div className="mt-2">
            <Progress value={progress} className="h-1 mb-1" />
            <span className="text-xs text-gray-400">{progress}%</span>
          </div>
        )}
        
        {/* Alerts for SDI */}
        {variant === 'sdi' && alerts && alerts > 0 && (
          <Badge className="mt-2 bg-red-500/20 text-red-300 border-red-500/30">
            {alerts} Alert{alerts > 1 ? 's' : ''}
          </Badge>
        )}
      </CardContent>
    </CardSpotlight>
  );
}

// components/modules/shared/ModuleHeader.tsx
interface ModuleHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function ModuleHeader({ icon, title, subtitle, actions }: ModuleHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </CardHeader>
  );
}
```

### **Step 3: tRPC Router Structure**

```tsx
// server/api/routers/sdi/crisis.ts
export const crisisRouter = createTRPCRouter({
  getActiveCrises: publicProcedure.query(async ({ ctx }) => {
    // Real implementation would fetch from database
    return await ctx.db.globalCrisis.findMany({
      where: { status: { in: ['Active', 'Developing'] } },
      orderBy: { severity: 'desc' },
      include: {
        affectedRegions: true,
        responseTeams: true,
        internationalAid: true
      }
    });
  }),

  getCrisisMetrics: publicProcedure.query(async ({ ctx }) => {
    return {
      responseReadiness: await calculateResponseReadiness(ctx.db),
      aidCoordination: await getAidCoordinationStats(ctx.db),
      predictiveAnalysis: await getCrisisPredictions(ctx.db)
    };
  }),

  updateCrisisResponse: protectedProcedure
    .input(z.object({
      crisisId: z.string(),
      responseActions: z.array(z.string()),
      resourceAllocation: z.record(z.number())
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.crisisResponse.create({
        data: {
          crisisId: input.crisisId,
          actions: input.responseActions,
          resources: input.resourceAllocation,
          coordinatorId: ctx.user.id
        }
      });
    })
});

// server/api/routers/eci/strategic.ts
export const strategicRouter = createTRPCRouter({
  getStrategicProjects: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.strategicProject.findMany({
        where: { countryId: input.countryId },
        include: {
          milestones: true,
          budget: true,
          stakeholders: true
        }
      });
    }),

  createProject: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      budget: z.number(),
      timeline: z.object({
        start: z.date(),
        end: z.date()
      }),
      objectives: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.strategicProject.create({
        data: {
          ...input,
          countryId: ctx.user.countryId,
          status: 'Planning',
          progress: 0
        }
      });
    }),

  updateProjectProgress: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      progress: z.number().min(0).max(100),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.strategicProject.update({
        where: { id: input.projectId },
        data: {
          progress: input.progress,
          lastUpdated: new Date(),
          updateNotes: input.notes
        }
      });
    })
});
```

### **Step 4: Module Access Control**

```tsx
// lib/module-permissions.ts
export interface ModulePermissions {
  sdi: {
    crisis: boolean;
    economic: boolean;
    diplomatic: boolean;
    threat: boolean;
    events: boolean;
    trade: boolean;
    tech: boolean;
    resources: boolean;
  };
  eci: {
    strategic: boolean;
    crisisResponse: boolean;
    intelligence: boolean;
    resources: boolean;
    infrastructure: boolean;
    defense: boolean;
    culture: boolean;
    science: boolean;
    environment: boolean;
    border: boolean;
    media: boolean;
    special: boolean;
  };
}

export function getModulePermissions(user: UserProfile): ModulePermissions {
  const basePermissions: ModulePermissions = {
    sdi: {
      crisis: true,
      economic: true,
      diplomatic: true,
      threat: false,
      events: true,
      trade: true,
      tech: false,
      resources: true
    },
    eci: {
      strategic: !!user.countryId,
      crisisResponse: !!user.countryId,
      intelligence: false,
      resources: !!user.countryId,
      infrastructure: !!user.countryId,
      defense: false,
      culture: !!user.countryId,
      science: !!user.countryId,
      environment: !!user.countryId,
      border: false,
      media: !!user.countryId,
      special: false
    }
  };

  // Enhanced permissions for admin/DM users
  if (user.role === 'admin' || user.role === 'dm') {
    Object.keys(basePermissions.sdi).forEach(key => {
      basePermissions.sdi[key as keyof typeof basePermissions.sdi] = true;
    });
    Object.keys(basePermissions.eci).forEach(key => {
      basePermissions.eci[key as keyof typeof basePermissions.eci] = true;
    });
  }

  // Special permissions based on user achievements or tier
  if (user.country?.economicTier === 'Advanced') {
    basePermissions.eci.intelligence = true;
    basePermissions.eci.defense = true;
    basePermissions.sdi.threat = true;
  }

  return basePermissions;
}
```

### **Step 5: Module Navigation Component**

```tsx
// components/modules/shared/ModuleNavigation.tsx
interface ModuleNavigationProps {
  interface: 'sdi' | 'eci';
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  userPermissions: ModulePermissions;
}

export function ModuleNavigation({ 
  interface: interfaceType, 
  activeModule, 
  onModuleChange, 
  userPermissions 
}: ModuleNavigationProps) {
  const sdiModules = [
    { id: 'crisis', name: 'Crisis Management', icon: '🚨' },
    { id: 'economic', name: 'Economic Intelligence', icon: '💹' },
    { id: 'diplomatic', name: 'Diplomatic Matrix', icon: '🤝' },
    { id: 'threat', name: 'Threat Assessment', icon: '🛡️' },
    { id: 'events', name: 'Global Events', icon: '📅' },
    { id: 'trade', name: 'Trade Monitor', icon: '🚢' },
    { id: 'tech', name: 'Tech Transfer', icon: '🔬' },
    { id: 'resources', name: 'Resource Command', icon: '⚡' }
  ];

  const eciModules = [
    { id: 'strategic', name: 'Strategic Planning', icon: '🎯' },
    { id: 'crisis-response', name: 'Crisis Response', icon: '🚨' },
    { id: 'intelligence', name: 'Intelligence Ops', icon: '🕵️' },
    { id: 'resources', name: 'Resource Management', icon: '⛏️' },
    { id: 'infrastructure', name: 'Infrastructure', icon: '🏗️' },
    { id: 'defense', name: 'Defense & Security', icon: '🛡️' },
    { id: 'culture', name: 'Cultural Ministry', icon: '🎭' },
    { id: 'science', name: 'Science & Tech', icon: '🔬' },
    { id: 'environment', name: 'Environmental', icon: '🌍' },
    { id: 'border', name: 'Border Control', icon: '🛂' },
    { id: 'media', name: 'Public Relations', icon: '📺' },
    { id: 'special', name: 'Special Operations', icon: '🎭' }
  ];

  const modules = interfaceType === 'sdi' ? sdiModules : eciModules;
  const permissions = userPermissions[interfaceType];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      {modules.map(module => {
        const hasAccess = permissions[module.id as keyof typeof permissions];
        
        if (!hasAccess) {
          return (
            <div key={module.id} className="relative">
              <ModuleCard
                {...module}
                status="Restricted"
                selected={false}
                onClick={() => {}}
                variant={interfaceType}
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <span className="text-red-400 text-xs">🔒 Restricted</span>
              </div>
            </div>
          );
        }

        return (
          <ModuleCard
            key={module.id}
            {...module}
            status="Available"
            selected={activeModule === module.id}
            onClick={() => onModuleChange(module.id)}
            variant={interfaceType}
          />
        );
      })}
    </div>
  );
}
```

---

## 🚀 Implementation Timeline

### **Week 1-2: Foundation**
1. Create module file structure
2. Implement base ModuleCard and ModuleHeader components
3. Set up basic tRPC routers for core modules
4. Create module permission system

### **Week 3-4: SDI Modules**
1. Crisis Management Center (priority)
2. Economic Intelligence Hub
3. Diplomatic Relations Matrix
4. Basic data integration

### **Week 5-6: ECI Modules**
1. Strategic Planning Center (priority)
2. Resource Management Hub
3. Intelligence Operations
4. Personal nation data integration

### **Week 7-8: Advanced Features**
1. Cross-module data sharing
2. Real-time updates and notifications
3. Advanced permissions and access control
4. Mobile optimization

### **Week 9-10: Polish & Security**
1. Security audit for classified modules
2. Performance optimization
3. User testing and feedback
4. Documentation and training

---

## 🔒 Security Considerations

### **Classification Levels**
- **Public**: Basic SDI modules, general information
- **Restricted**: Advanced SDI modules, basic ECI modules
- **Confidential**: Sensitive nation data, strategic planning
- **Secret**: Intelligence operations, threat assessment
- **Top Secret**: Special operations, classified projects

### **Access Control**
- Role-based permissions (Admin, DM, Player, Observer)
- Nation-tier based unlocking (Advanced nations get more access)
- Achievement-based module unlocking
- Time-based access restrictions for sensitive operations

This framework creates a realistic government simulation with proper intelligence and operational separation while maintaining security and access control appropriate for different user roles and nation capabilities.