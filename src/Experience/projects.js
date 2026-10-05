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
  airFrance: {
    title: 'Air France Industries',
    tagline: 'Predictive maintenance, from paper to data.',
    status: '2015 – 2018',
    icon: 'projects/airfrance/icon.svg',
    summary:
      'In the Innovation District, I initiated PROGNOS after auditing the IT tools of the ECU repair workshop, where records still lived on paper and USB keys. The data was there, but not usable at scale.',
    highlights: [
      'Brought big data techniques from the tech industry into aircraft maintenance',
      'Parsed years of paper repair records to study the data and predict the next equipment failure',
      'A method made for this industry: highly reliable components tend to fail around the same extended lifetime',
      'Built the PoC, presented it, and pitched it to the team that industrialized the project',
    ],
    role: 'Fullstack Software Engineer, Innovation District',
    lesson:
      "Early in my career, I thought the tool and the tech were what mattered most. PROGNOS taught me that tech has to be adapted to its industry, then distributed through pitching and training. Those are the pillars of a successful project: if one fails, the project fails. It's the path I've followed in every adventure since.",
    accent: '#d6202f',
  },
}
