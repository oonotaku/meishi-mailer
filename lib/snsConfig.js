export const SNS_CONFIG = [
  // 個人でつながる
  { key: 'sns_line',      label: 'LINE',      category: 'personal', inputMode: 'qr',       baseUrl: null,                         icon: 'line',      color: '#06C755' },
  { key: 'sns_whatsapp',  label: 'WhatsApp',  category: 'personal', inputMode: 'qr',       baseUrl: null,                         icon: 'whatsapp',  color: '#25D366' },
  { key: 'sns_instagram', label: 'Instagram', category: 'personal', inputMode: 'username', baseUrl: 'https://instagram.com/',     icon: 'instagram', color: '#E1306C', prefix: 'instagram.com/',    helpUrl: 'https://instagram.com/accounts/edit/' },
  { key: 'sns_x',         label: 'X',         category: 'personal', inputMode: 'username', baseUrl: 'https://x.com/',             icon: 'x',         color: '#000000', prefix: 'x.com/',            helpUrl: 'https://x.com/settings/account' },
  { key: 'sns_facebook',  label: 'Facebook',  category: 'personal', inputMode: 'url',      baseUrl: null,                         icon: 'facebook',  color: '#1877F2', placeholder: 'https://facebook.com/username', helpUrl: 'https://facebook.com/me' },
  { key: 'sns_tiktok',    label: 'TikTok',    category: 'personal', inputMode: 'username', baseUrl: 'https://tiktok.com/@',       icon: 'tiktok',    color: '#010101', prefix: 'tiktok.com/@',      helpUrl: 'https://tiktok.com/' },
  { key: 'sns_threads',   label: 'Threads',   category: 'personal', inputMode: 'username', baseUrl: 'https://threads.net/@',      icon: 'threads',   color: '#000000', prefix: 'threads.net/@',     helpUrl: 'https://threads.net/' },
  { key: 'sns_telegram',  label: 'Telegram',  category: 'personal', inputMode: 'username', baseUrl: 'https://t.me/',              icon: 'telegram',  color: '#2AABEE', prefix: 't.me/',             helpUrl: 'https://t.me/' },
  { key: 'sns_wechat',    label: 'WeChat',    category: 'personal', inputMode: 'url',      baseUrl: null,                         icon: 'wechat',    color: '#07C160', placeholder: 'https://...' },

  // ビジネス・クリエイター
  { key: 'sns_linkedin',  label: 'LinkedIn',  category: 'business', inputMode: 'username', baseUrl: 'https://linkedin.com/in/',   icon: 'linkedin',  color: '#0A66C2', prefix: 'linkedin.com/in/',  helpUrl: 'https://linkedin.com/public-profile/settings/' },
  { key: 'sns_github',    label: 'GitHub',    category: 'business', inputMode: 'username', baseUrl: 'https://github.com/',        icon: 'github',    color: '#24292e', prefix: 'github.com/',       helpUrl: 'https://github.com/settings/profile' },
  { key: 'sns_vercel',    label: 'Vercel',    category: 'business', inputMode: 'username', baseUrl: 'https://vercel.com/',        icon: 'vercel',    color: '#000000', prefix: 'vercel.com/',       helpUrl: 'https://vercel.com/dashboard' },
  { key: 'sns_note',      label: 'note',      category: 'business', inputMode: 'username', baseUrl: 'https://note.com/',          icon: null,        color: '#41C9B4', prefix: 'note.com/',         helpUrl: 'https://note.com/' },
  { key: 'sns_wantedly',  label: 'Wantedly',  category: 'business', inputMode: 'url',      baseUrl: null,                         icon: 'wantedly',  color: '#21bcb4', placeholder: 'https://www.wantedly.com/id/...',  helpUrl: 'https://www.wantedly.com/' },
  { key: 'sns_youtube',   label: 'YouTube',   category: 'business', inputMode: 'username', baseUrl: 'https://youtube.com/@',      icon: 'youtube',   color: '#FF0000', prefix: 'youtube.com/@',     helpUrl: 'https://studio.youtube.com/' },
  { key: 'sns_discord',   label: 'Discord',   category: 'business', inputMode: 'url',      baseUrl: null,                         icon: 'discord',   color: '#5865F2', placeholder: 'https://discord.gg/...' },
  { key: 'sns_bluesky',   label: 'Bluesky',   category: 'business', inputMode: 'username', baseUrl: 'https://bsky.app/profile/',  icon: 'bluesky',   color: '#0085FF', prefix: 'bsky.app/profile/', helpUrl: 'https://bsky.app/settings' },
  { key: 'sns_pinterest', label: 'Pinterest', category: 'business', inputMode: 'username', baseUrl: 'https://pinterest.com/',     icon: 'pinterest', color: '#E60023', prefix: 'pinterest.com/',    helpUrl: 'https://pinterest.com/settings/' },

  // 名刺管理アプリ
  { key: 'sns_sansan',   label: 'Sansan',   category: 'cardapp', inputMode: 'url', baseUrl: null, icon: null, color: '#1a73e8', placeholder: 'https://...' },
  { key: 'sns_eight',    label: 'Eight',    category: 'cardapp', inputMode: 'url', baseUrl: null, icon: null, color: '#0066FF', placeholder: 'https://8card.net/...' },
  { key: 'sns_mybridge', label: 'myBridge', category: 'cardapp', inputMode: 'url', baseUrl: null, icon: null, color: '#00a99d', placeholder: 'https://...' },
]

export const PRESET_CATEGORIES = {
  business: ['business', 'cardapp'],
  personal: ['personal'],
  all: ['personal', 'business', 'cardapp'],
}

export const CATEGORY_LABELS = {
  personal: '個人でつながる',
  business: 'ビジネス・クリエイター',
  cardapp: '名刺管理アプリ',
}
