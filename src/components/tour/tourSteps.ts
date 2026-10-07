export interface TourStep {
  id: string;
  target: string; // Semantic data-tour selector without brackets, e.g. "sidebar.contacts"
  tab?: 'dashboard' | 'contacts' | 'import' | 'lists' | 'templates' | 'campaigns' | 'ai' | 'audit' | 'settings';
  title: string;
  instruction: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  badge?: string;
  tip?: string;
  autoAction?: 'click' | 'highlight';
  expectedAction?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard-overview',
    target: 'dashboard.welcome',
    tab: 'dashboard',
    title: 'Mission Control Dashboard',
    instruction: 'Welcome to ReachOut OS! This is your real-time command center displaying verified contacts, live campaign progress, and delivery performance.',
    position: 'bottom',
    badge: '1 / 7 Overview',
    tip: 'Your active workspace and Supabase PostgreSQL connection status are anchored in the top header.'
  },
  {
    id: 'contacts-section',
    target: 'sidebar.contacts',
    tab: 'dashboard',
    title: 'Lead & Contact Directory',
    instruction: 'Click on Contacts in the sidebar to view and manage your verified customer list, E.164 phone formats, and global opt-out blocklists.',
    position: 'right',
    badge: '2 / 7 Navigation',
    tip: 'ReachOut OS strictly validates international phone codes like +91 and +1 to protect deliverability.'
  },
  {
    id: 'contacts-add',
    target: 'contacts.add-btn',
    tab: 'contacts',
    title: 'Add New Contact',
    instruction: 'This button opens the contact drawer where you can register leads, assign custom tags, and set global communication blocklists.',
    position: 'left',
    badge: '3 / 7 Data Ingestion',
    tip: 'You can also use the CSV Import Wizard to bulk-ingest hundreds of spreadsheet rows with formula injection defenses.'
  },
  {
    id: 'templates-section',
    target: 'sidebar.templates',
    tab: 'contacts',
    title: 'Multi-Channel Templates',
    instruction: 'Now, let’s navigate to Templates. This is where you create reusable outreach messages for WhatsApp and Email.',
    position: 'right',
    badge: '4 / 7 Copywriting',
    tip: 'Templates support dynamic tags like {{firstName}} and {{companyName}} for automated personalization.'
  },
  {
    id: 'templates-new',
    target: 'templates.new-btn',
    tab: 'templates',
    title: 'Create Your Template',
    instruction: 'Click here to craft a new WhatsApp or Email template with live device preview and tag validation.',
    position: 'left',
    badge: '5 / 7 Personalization',
    tip: 'WhatsApp messages under 3 sentences generate up to 2.8x higher reply rates.'
  },
  {
    id: 'campaigns-section',
    target: 'sidebar.campaigns',
    tab: 'templates',
    title: 'Campaigns & Safe Dispatch',
    instruction: 'Move to Campaigns to link your audience list with a template and launch safe, 1-click human-in-the-loop outreach.',
    position: 'right',
    badge: '6 / 7 Dispatch Engine',
    tip: 'Our Manual Sending Workspace lets you send directly via official WhatsApp and Email clients without risky bot bans.'
  },
  {
    id: 'ai-copilot-section',
    target: 'sidebar.ai',
    tab: 'campaigns',
    title: 'Gemini AI Outreach Copilot',
    instruction: 'Finish up by exploring the AI Copilot. Generate tailored pitches, polish your tone, and run spam-guardrail compliance checks.',
    position: 'right',
    badge: '7 / 7 AI Intelligence',
    tip: 'The safety checker flags high-pressure phrasing and spam triggers before you dispatch messages.'
  }
];
