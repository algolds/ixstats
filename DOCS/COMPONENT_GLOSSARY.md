# IxStats Design System – Component Glossary

Welcome to the **IxStats Design System Component Glossary**. This document provides detailed usage, props, and examples for all major UI components, including enhanced glassmorphism and advanced/animated components. Use this as a reference for building consistent, beautiful, and maintainable UIs.

---

## Table of Contents
- [Core Components](#core-components)
  - [Card](#card)
  - [Button](#button)
  - [Badge](#badge)
  - [Input](#input)
  - [Select](#select)
  - [Tabs](#tabs)
  - [Accordion](#accordion)
  - [Dialog](#dialog)
  - [Alert](#alert)
  - [Progress](#progress)
  - [Table](#table)
- [Enhanced Glassmorphism Components](#enhanced-glassmorphism-components)
  - [EnhancedCard / GlassCard](#enhancedcard--glasscard)
  - [EnhancedButton / GlassButton](#enhancedbutton--glassbutton)
- [Advanced & Animated Components](#advanced--animated-components)
  - [LayoutGrid](#layoutgrid)
  - [InfiniteMovingCards](#infinitemovingcards)
  - [FocusCards](#focuscards)
  - [AppleCardsCarousel](#applecardscarousel)
  - [AuroraBackground](#aurorabackground)
  - [BackgroundGradient](#backgroundgradient)
  - [AnimatedTooltip](#animatedtooltip)
  - [3d-Card, 3d-Pin, GlareCard, GlowingEffect, HoverBorderGradient, MovingBorder, Cover, Sparkles, TracingBeam, BackgroundLines, LinkPreview, Sidebar](#other-advanced-components)

---

## Core Components

### Card
- **Description**: Basic content container with padding, border, and shadow.
- **Subcomponents**: `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, `CardDescription`, `CardAction`
- **Props**: All standard `div` props.
- **Example**:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>Content goes here</CardContent>
    <CardFooter>Footer</CardFooter>
  </Card>
  ```

### Button
- **Description**: Standard button with variants and sizes.
- **Props**:
  - `variant`: `'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'`
  - `size`: `'default' | 'sm' | 'lg' | 'icon'`
  - `asChild`: Render as another element (e.g., `<a>`)
- **Example**:
  ```tsx
  <Button variant="default" size="lg">Click Me</Button>
  <Button variant="outline">Outline</Button>
  ```

### Badge
- **Description**: Small label for status or categorization.
- **Props**: `variant`, `className`, all `span` props.
- **Example**:
  ```tsx
  <Badge variant="success">Active</Badge>
  ```

### Input
- **Description**: Styled input field.
- **Props**: All standard `input` props.
- **Example**:
  ```tsx
  <Input placeholder="Enter value" />
  ```

### Select
- **Description**: Custom select dropdown.
- **Props**: All standard select props, plus `size`, `variant`.
- **Example**:
  ```tsx
  <Select>
    <SelectItem value="1">One</SelectItem>
    <SelectItem value="2">Two</SelectItem>
  </Select>
  ```

### Tabs
- **Description**: Tabbed navigation.
- **Props**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
- **Example**:
  ```tsx
  <Tabs>
    <TabsList>
      <TabsTrigger value="a">Tab A</TabsTrigger>
      <TabsTrigger value="b">Tab B</TabsTrigger>
    </TabsList>
    <TabsContent value="a">Content A</TabsContent>
    <TabsContent value="b">Content B</TabsContent>
  </Tabs>
  ```

### Accordion
- **Description**: Expand/collapse content sections.
- **Props**: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`.
- **Example**:
  ```tsx
  <Accordion type="single" collapsible>
    <AccordionItem value="item-1">
      <AccordionTrigger>Section 1</AccordionTrigger>
      <AccordionContent>Details for section 1</AccordionContent>
    </AccordionItem>
  </Accordion>
  ```

### Dialog
- **Description**: Modal dialog for overlays.
- **Props**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`.
- **Example**:
  ```tsx
  <Dialog>
    <DialogTrigger>Open</DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Dialog Title</DialogTitle>
      </DialogHeader>
      Dialog content here
    </DialogContent>
  </Dialog>
  ```

### Alert
- **Description**: Informational or error alert.
- **Props**: `variant` (`default`, `destructive`), `className`.
- **Example**:
  ```tsx
  <Alert variant="destructive">Something went wrong!</Alert>
  ```

### Progress
- **Description**: Progress bar.
- **Props**: `value` (number, 0-100), `className`.
- **Example**:
  ```tsx
  <Progress value={60} />
  ```

### Table
- **Description**: Styled table with header, body, footer.
- **Props**: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead`, `TableFooter`, `TableCaption`.
- **Example**:
  ```tsx
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Value</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Foo</TableCell>
        <TableCell>Bar</TableCell>
      </TableRow>
    </TableBody>
  </Table>
  ```

---

## Enhanced Glassmorphism Components

### EnhancedCard / GlassCard
- **Description**: Card with glassmorphism, blur, glow, and nation theming.
- **Props**:
  - `variant`: `'default' | 'glass' | 'diplomatic' | 'economic' | 'military' | 'cultural'`
  - `glow`: `boolean | 'hover' | 'active'`
  - `hover`: `'none' | 'lift' | 'glow' | 'scale'`
  - `blur`: `'subtle' | 'moderate' | 'prominent'`
  - All `Card` props
- **Example**:
  ```tsx
  <EnhancedCard variant="diplomatic" glow hover="lift" blur="moderate">
    <CardHeader>
      <CardTitle>Diplomatic Card</CardTitle>
    </CardHeader>
    <CardContent>Diplomatic content</CardContent>
  </EnhancedCard>
  ```

### EnhancedButton / GlassButton
- **Description**: Button with glass, glow, and nation theming.
- **Props**:
  - `glass`: `boolean` — glassmorphism effect
  - `glow`: `boolean | 'hover'`
  - `nation`: `boolean` — nation-specific color
  - All `Button` props
- **Example**:
  ```tsx
  <EnhancedButton glass glow="hover" nation>
    Nation Action
  </EnhancedButton>
  ```

---

## Advanced & Animated Components

### LayoutGrid
- **Description**: Responsive grid for displaying cards with selection/expansion.
- **Props**: `cards` (array of card objects)
- **Example**:
  ```tsx
  <LayoutGrid cards={cardArray} />
  ```

### InfiniteMovingCards
- **Description**: Horizontally scrolling, animated card list (e.g., testimonials).
- **Props**:
  - `items`: Array of `{ quote, name, title }`
  - `direction`: `'left' | 'right'`
  - `speed`: `'fast' | 'normal' | 'slow'`
  - `pauseOnHover`: `boolean`
- **Example**:
  ```tsx
  <InfiniteMovingCards items={quotesArray} direction="left" speed="fast" />
  ```

### FocusCards
- **Description**: Card grid with hover focus effect.
- **Props**: `cards` (array of card objects)
- **Example**:
  ```tsx
  <FocusCards cards={cardArray} />
  ```

### AppleCardsCarousel
- **Description**: Animated, scrollable card carousel with modal expansion.
- **Props**: `items` (array of JSX elements)
- **Example**:
  ```tsx
  <Carousel items={carouselItems} />
  ```

### AuroraBackground
- **Description**: Animated aurora/gradient background for hero sections.
- **Props**: `children`, `showRadialGradient`, `className`
- **Example**:
  ```tsx
  <AuroraBackground>
    <h1>Welcome</h1>
  </AuroraBackground>
  ```

### BackgroundGradient
- **Description**: Animated, multi-color gradient background wrapper.
- **Props**: `children`, `animate`, `className`, `containerClassName`
- **Example**:
  ```tsx
  <BackgroundGradient animate>
    <Card>With animated border</Card>
  </BackgroundGradient>
  ```

### AnimatedTooltip
- **Description**: Animated tooltip for avatars or icons.
- **Props**: `items` (array of `{ id, name, designation, image }`)
- **Example**:
  ```tsx
  <AnimatedTooltip items={teamArray} />
  ```

### Other Advanced Components
- **3d-Card, 3d-Pin, GlareCard, GlowingEffect, HoverBorderGradient, MovingBorder, Cover, Sparkles, TracingBeam, BackgroundLines, LinkPreview, Sidebar**
- **Description**: For interactive, animated, or visually rich UI sections. Each has unique props for animation, effect, or layout.
- **Usage**: See the respective file in `src/components/ui/` for details and examples.

---

## Tips for Use
- **Import** components from `@/components/ui/`.
- **Compose**: Use base components for structure, enhanced for glassmorphism/theming.
- **Customize**: Pass props for variants, effects, and theming.
- **Extend**: Use advanced components for hero sections, dashboards, and interactive UIs.

---

For more details, see the source code in each component file or the [IxStats Design System Style Guide](./IxStats%20Design%20System%20Style%20Guide). 