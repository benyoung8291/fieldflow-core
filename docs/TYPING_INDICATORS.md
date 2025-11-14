# Typing Indicators

Real-time typing indicators show when users are actively editing fields in forms or documents, displaying their name next to the field they're working on.

## Features

- **Real-time typing detection**: Shows "[User] is typing..." when actively editing
- **Auto-stop after inactivity**: Typing indicator disappears after 2 seconds of no input
- **Color-coded**: Each user gets a unique color for easy identification
- **Field-specific**: Only shows typing indicators for the specific field being edited
- **Multiple users**: Shows count when multiple users are editing the same field

## How to Use

### 1. Set up presence tracking

```tsx
import { usePresence } from "@/hooks/usePresence";

const { onlineUsers, startTyping, stopTyping } = usePresence({
  page: "your-page-name",
});
```

### 2. Wrap fields with FieldPresenceWrapper

```tsx
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";

<FieldPresenceWrapper
  fieldName="customer_name"
  onlineUsers={onlineUsers}
>
  <Input {...yourProps} />
</FieldPresenceWrapper>
```

### 3. Add typing tracking (Option A - Using the hook)

```tsx
import { useFieldTyping } from "@/hooks/useFieldTyping";

const nameTyping = useFieldTyping({
  fieldName: "customer_name",
  startTyping,
  stopTyping,
});

<Input
  {...nameTyping.onFocus}
  {...nameTyping.onChange}
  {...nameTyping.onBlur}
/>
```

### 3. Add typing tracking (Option B - Manual)

```tsx
<Input
  onFocus={() => startTyping("customer_name")}
  onChange={() => startTyping("customer_name")}
  onBlur={() => stopTyping()}
/>
```

## Complete Example

See `src/components/presence/TypingIndicatorExample.tsx` for a complete working example.

```tsx
import { usePresence } from "@/hooks/usePresence";
import { useFieldTyping } from "@/hooks/useFieldTyping";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import { Input } from "@/components/ui/input";

export default function MyForm() {
  const { onlineUsers, startTyping, stopTyping } = usePresence({
    page: "my-form",
  });

  const nameTyping = useFieldTyping({
    fieldName: "name",
    startTyping,
    stopTyping,
  });

  return (
    <FieldPresenceWrapper fieldName="name" onlineUsers={onlineUsers}>
      <Input
        placeholder="Name"
        onFocus={nameTyping.onFocus}
        onChange={nameTyping.onChange}
        onBlur={nameTyping.onBlur}
      />
    </FieldPresenceWrapper>
  );
}
```

## Visual Indicators

1. **Colored Border Glow**: When a user is typing, a colored glow appears around the field matching their avatar color from the presence panel
2. **Typing Indicator Badge**: Shows "[User] is typing..." above the field with their color
3. **Viewing Indicator**: Shows user's first name in top-right when viewing but not typing
4. **Pulsing Animation**: The colored glow pulses to draw attention to active editing

The colors are consistent across:
- Remote cursor tracking
- Presence panel avatars
- Field typing indicators
- Click animations

## Implementation Notes

- Typing automatically stops after 2 seconds of inactivity
- Each user gets a consistent color throughout their session
- Typing indicators only show to other users, not to the person typing
- Works with Input, Textarea, and other form components
