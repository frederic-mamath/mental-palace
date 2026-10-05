// Portfolio content, one entry per project landmark on the island.
// Drafted from each project's own docs and landing page: review before shipping.
export default {
  doubleTap: {
    title: 'Double Tap',
    tagline: 'Reply smarter. Not harder.',
    status: 'Live on the App Store',
    icon: 'projects/doubletap/icon.png',
    summary:
      'An iOS app that crafts the perfect reply to any conversation, in your own tone. Double-tap the back of your iPhone inside Tinder, iMessage, WhatsApp or any chat, pick a vibe, and the reply lands as a notification, ready to paste.',
    highlights: [
      'Back-tap shortcut: reply without ever leaving the conversation',
      'Privacy first: on-device OCR with Apple Vision, screenshots never leave the iPhone',
      'Tone profiles set at onboarding: playful, direct or warm',
    ],
    role: 'Solo founder: product, design, iOS app, backend and launch',
    stack: ['React Native', 'Expo', 'TypeScript', 'iOS Shortcuts', 'Apple Vision', 'Supabase', 'RevenueCat', 'Next.js', 'PostHog'],
    links: [
      { label: 'App Store', url: 'https://apps.apple.com/app/id6782379771' },
      { label: 'Website', url: 'https://doubletap.mamath.fr' },
    ],
    accent: '#E8611A',
  },
}
