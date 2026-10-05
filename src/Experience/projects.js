// Portfolio content, one entry per project landmark on the island.
// Drafted from each project's own docs and landing page: review before shipping.
const projects = {
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

// Story beats of the hobby island: how these stories shaped the user, condensed from their own words.
// Same card fields as projects; `emblem` picks the drawing on the story stone.
export const stories = {
  shonen: {
    title: 'The Shonen Spirit',
    status: 'Naruto · Bleach · One Piece',
    tagline: 'Never give up. Give your all.',
    icon: 'stories/shonen.svg',
    emblem: 'shuriken',
    summary:
      'Naruto, Bleach and One Piece taught me the shonen spirit: never giving up, always aspiring to reach new heights. And it is okay not to be the best: what matters is giving your all.',
    highlights: [
      'At worst, you did everything you could, so you have no regrets',
      'At best, you reach your goal, and you meet people who are trying too: a virtuous cycle along the way',
      'The path is hard: I learned to appreciate failure and to live with it',
    ],
    lesson: 'Give your all. At worst, no regrets; at best, you reach your goal, and you never walk the path alone.',
    accent: '#f28c28',
  },
  onlineGames: {
    title: 'Chaos and Mastery',
    status: 'World of Warcraft · League of Legends · StarCraft',
    tagline: 'Accept the chaos. Master what depends on you.',
    icon: 'stories/online-games.svg',
    emblem: 'crystal',
    summary:
      'Online games taught me the chaos of living in society. Life is not fair, and you have to accept it: you never play alone, you do not always share everyone\'s plan, and each person lives by their own agenda.',
    highlights: [
      'Mastering the technical side only depends on you',
      'That mastery is the foundation for reaching the highest level',
      'I have played StarCraft since I was 5, and reached Master rank in StarCraft 2',
    ],
    lesson: 'Life is not fair, and you have to accept it. But mastering the technical aspect only depends on you.',
    accent: '#8b5cf6',
  },
  ff7: {
    title: 'The Taste of Storytelling',
    status: 'Final Fantasy VII',
    tagline: 'Every detail matters.',
    icon: 'stories/ff7.svg',
    emblem: 'sword',
    summary:
      'Final Fantasy VII gave me the taste of storytelling. Every detail matters in how a story is delivered: the tone, the music, and the control you give to the player.',
    highlights: [
      'By giving control, you make people live the adventure and FEEL the immersion',
      'These are "details", but they contribute massively to how the story is delivered',
    ],
    lesson: 'All these "details" are what make people feel the story instead of just hearing it.',
    accent: '#3fbf8f',
  },
}

export default projects
