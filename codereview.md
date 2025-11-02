# Code Review Checklist & Template

## Purpose

This document serves as a living template for conducting thorough code reviews, with a focus on catching common issues that lead to dead code, unused imports, and unnecessary duplication.

---

## 🔍 Code Review Categories

### 1. Dead Code Detection

#### Unused Components

- [ ] Check for component files that are never imported
- [ ] Search for exports that have no references
- [ ] Verify all custom hooks are actually being used

**How to Check:**

```bash
# Find all component files
find src/components -name "*.tsx" -o -name "*.ts"

# For each component, search for imports
grep -r "from ['\"]\.\./components/COMPONENT_NAME" src/
```

**Common Patterns:**

- Leftover prototype/experimental components
- Refactored components that weren't deleted
- "Draft" or "old" versions kept alongside new implementations

---

#### Unused Imports

- [ ] Review all import statements at the top of files
- [ ] Check if imported components/functions are used in the file
- [ ] Look for imports from UI libraries that are replaced with custom elements

**How to Check:**

```bash
# Search for specific import patterns
grep -n "^import.*from" src/app/**/*.tsx

# For each import, verify usage with:
grep -n "IMPORTED_NAME" FILE_PATH
```

**Common Culprits:**

- `Button` component imported but custom `<button>` elements used instead
- Icon imports that were replaced during refactoring
- Utility functions imported but logic was inlined
- Type imports that are no longer needed

**Example:**

```typescript
// ❌ BAD - Unused import
import { Button } from '@/components/ui/button';

export function MyForm() {
  return (
    <button className="...">Submit</button> // Custom button, not using Button
  );
}

// ✅ GOOD - Remove unused import
export function MyForm() {
  return (
    <button className="...">Submit</button>
  );
}
```

---

#### Unused Props

- [ ] Check props passed to components that aren't in their interface
- [ ] Verify prop types match component definitions
- [ ] Look for optional props that have no effect

**How to Check:**

1. Read component interface/props type
2. Search for all usages of that component
3. Verify each prop is defined and used

**Example:**

```typescript
// ❌ BAD - sidebarTitle not in FormLayoutProps
<FormLayout
  title="Hello"
  sidebarTitle="Extra info" // This prop doesn't exist!
/>

// ✅ GOOD - Only use defined props
<FormLayout
  title="Hello"
/>
```

---

### 2. Code Duplication Detection

#### Repeated Styling Patterns

- [ ] Look for className strings repeated across files
- [ ] Check for inline style objects that are duplicated
- [ ] Identify button variants that could be extracted

**How to Check:**

```bash
# Find repeated className patterns
grep -r "inline-flex items-center justify-center" src/
```

**Refactoring Strategy:**

- Extract to a shared constant or utility function
- Create reusable component variants
- Use CSS classes or CSS-in-JS patterns

**Example:**

```typescript
// ❌ BAD - Repeated across 9 files
<button
  className={`inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-all shadow-sm ${
    isValid ? 'bg-primary text-white hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
  }`}
>
  Continue
</button>

// ✅ GOOD - Extract to reusable component
// components/ui/submit-button.tsx
export function SubmitButton({ isValid, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-all shadow-sm",
        isValid
          ? "bg-primary text-white hover:bg-primary/90"
          : "bg-muted text-muted-foreground cursor-not-allowed"
      )}
      disabled={!isValid}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

#### Repeated Component Patterns

- [ ] Identify UI patterns used in multiple places (back buttons, navigation, etc.)
- [ ] Check for form validation logic that's copy-pasted
- [ ] Look for error handling patterns that are duplicated

**Common Patterns to Extract:**

- Back navigation buttons
- Form error state management
- Loading/empty states
- Confirmation dialogs

**Example:**

```typescript
// ❌ BAD - Repeated in every page
<button
  type="button"
  onClick={() => router.push('/previous-page')}
  className="inline-flex items-center justify-center rounded-lg p-2 text-foreground transition-all hover:bg-accent"
  aria-label="Back"
>
  <ArrowLeft className="h-5 w-5" />
</button>

// ✅ GOOD - Reusable BackButton component
// components/back-button.tsx
export function BackButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(to)}
      className="inline-flex items-center justify-center rounded-lg p-2 text-foreground transition-all hover:bg-accent"
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
```

---

#### Repeated Logic Patterns

- [ ] Check for error clearing logic duplicated across forms
- [ ] Look for validation patterns that could be hooks
- [ ] Identify state management patterns that repeat

**Refactoring Strategy:**

- Extract to custom hooks
- Create utility functions
- Use shared validation schemas

**Example:**

```typescript
// ❌ BAD - Repeated error clearing in every input
onChange={(e) => {
  setValue(e.target.value);
  if (errors.fieldName) {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.fieldName;
      return newErrors;
    });
  }
}}

// ✅ GOOD - Custom hook
function useClearError(errors: Record<string, string>, setErrors: Function) {
  return (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev: Record<string, string>) => {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      });
    }
  };
}

// Usage
const clearError = useClearError(errors, setErrors);

onChange={(e) => {
  setValue(e.target.value);
  clearError('fieldName');
}}
```

---

### 3. Data Completeness & Consistency

#### Constant Arrays & Objects

- [ ] Verify data arrays are complete (e.g., all 50 US states)
- [ ] Check that related constants are in sync
- [ ] Ensure enum values match their usage

**How to Check:**

- Count array items (should match expected total)
- Verify relationships between constants
- Check for typos or inconsistencies

**Example:**

```typescript
// ❌ BAD - Only 44 states listed
export const AVAILABLE_STATES = [
  'Alabama',
  'Arizona',
  // ... 42 more states
  // Missing: Alaska, Arkansas, Massachusetts, North Carolina, Oregon, Rhode Island
]

// ✅ GOOD - All 50 states
export const AVAILABLE_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  // ... all 50 states
]
```

---

### 4. Import Organization

#### Import Order

- [ ] React imports first
- [ ] Third-party libraries
- [ ] Local/internal imports (components, utils, types)
- [ ] Sort alphabetically within each group

**Example:**

```typescript
// ✅ GOOD - Clean import organization
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInYears } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormLayout } from '@/components/form-layout'

import { saveFormData, getFormData } from '@/lib/form-storage'
```

---

## 🤖 Automated Code Review Prompt

Use this prompt with a sub-agent to automate code review:

```
You are a code reviewer assistant. Analyze the codebase for the following issues:

1. **Dead Code Detection**
   - Find all components in src/components/ and verify each is imported somewhere
   - Check all import statements in src/app/ and verify each import is actually used
   - Look for props passed to components that don't exist in their interfaces

2. **Code Duplication**
   - Search for repeated className patterns (especially button styles)
   - Identify component patterns that appear in 3+ files
   - Find duplicated logic (error handling, validation, state management)

3. **Data Completeness**
   - Verify constant arrays are complete (check state lists, etc.)
   - Check for missing entries in related data structures

4. **Import Cleanliness**
   - Flag any unused imports
   - Report improper import organization

For each issue found:
- Specify the file path and line number
- Explain why it's an issue
- Provide a recommendation for fixing it
- Include a code example of the fix

Output format:
## Issue Category
**Location:** file.tsx:line
**Issue:** Description
**Recommendation:** What to do
**Example:** Code snippet
```

---

## 📋 Pre-Commit Checklist

Before submitting a PR, verify:

- [ ] No unused imports (run ESLint with unused vars check)
- [ ] No unused components in the components directory
- [ ] No props passed that don't exist in component interfaces
- [ ] Repeated code patterns extracted to reusables (if 3+ occurrences)
- [ ] Constant arrays are complete and accurate
- [ ] All icons imported are actually rendered
- [ ] Button/Link components are used if imported

---

## 🛠️ Tools & Commands

### Find Unused Imports

```bash
# Using grep to find imports and check usage
for file in src/app/**/*.tsx; do
  echo "Checking $file"
  grep "^import.*from" "$file" | while read import; do
    # Extract the imported name
    name=$(echo "$import" | sed -E "s/.*\{.*\}//" | awk '{print $2}')
    # Check if used in file
    count=$(grep -c "$name" "$file" || echo 0)
    if [ "$count" -le 1 ]; then
      echo "  ⚠️  Potentially unused: $name"
    fi
  done
done
```

### Find Component Files Never Imported

```bash
# Find all component files
find src/components -name "*.tsx" | while read component; do
  basename=$(basename "$component" .tsx)
  # Search for imports of this component
  matches=$(grep -r "from.*$basename" src/ | wc -l)
  if [ "$matches" -eq 0 ]; then
    echo "❌ Never imported: $component"
  fi
done
```

### Find Repeated className Patterns

```bash
# Find most common className patterns
grep -roh 'className="[^"]*"' src/ | sort | uniq -c | sort -rn | head -20
```

---

## 📚 Resources

- **ESLint Rules:** Enable `no-unused-vars` and `@typescript-eslint/no-unused-imports`
- **TypeScript:** Use strict mode to catch prop mismatches
- **IDE Tools:** Configure your editor to highlight unused imports

---

## 🎯 Review Findings Template

When conducting a review, document findings like this:

```markdown
## Code Review - [Date]

### Summary

- Files reviewed: X
- Dead code removed: Y lines
- Issues found: Z

### Critical Issues

1. [Issue description] - [File:Line]
2. [Issue description] - [File:Line]

### Improvements Suggested

1. [Improvement description]
2. [Improvement description]

### Action Items

- [ ] Fix critical issue #1
- [ ] Extract duplicated pattern X
- [ ] Add missing data Y
```

---

## 💡 Best Practices

1. **Component Creation:** Before creating a new component, check if a similar one exists
2. **Import Management:** Remove imports immediately when refactoring away from them
3. **Regular Audits:** Run dead code checks monthly
4. **Pull Request Reviews:** Use this checklist for every PR
5. **Automation:** Integrate ESLint and TypeScript checks in CI/CD

---

**Last Updated:** 2025-10-20
**Maintained By:** Development Team
