// Global boot logic, small helpers
export function $(sel, parent=document) { return parent.querySelector(sel) }
export function $all(sel, parent=document) { return Array.from(parent.querySelectorAll(sel)) }

window.addEventListener('load', () => {
  // Simple nav helper when offline: show current user state or redirect
  // If you add auth later, this is where you check tokens
  console.log('App booted')
})
