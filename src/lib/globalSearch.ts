export const GLOBAL_SEARCH_OPEN_EVENT = 'vestov:global-search-open'

export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_OPEN_EVENT))
}
