export const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export const pageview = (url) => {
  if (!GA_ID || typeof window === 'undefined') return
  window.gtag('config', GA_ID, { page_path: url })
}

export const event = ({ action, category, label, value }) => {
  if (!GA_ID || typeof window === 'undefined') return
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}
