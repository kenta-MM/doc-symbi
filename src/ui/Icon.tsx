const paths = {
  settings: 'M9 3h6l.5 2.5 2 1.2 2.4-.8 2 3.5-1.9 1.6v2l1.9 1.6-2 3.5-2.4-.8-2 1.2L15 21H9l-.5-2.5-2-1.2-2.4.8-2-3.5L4 13v-2L2.1 9.4l2-3.5 2.4.8 2-1.2L9 3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  ai: 'M5 5h14v14H5V5ZM9 9h6v6H9V9ZM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3',
  close: 'M6 6l12 12M6 18 18 6',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Zm0 2h18',
  refresh: 'M20 7v5h-5M20 12a8 8 0 1 0-2 6M20 7v5',
  file: 'M14 3H5v18h14V8l-5-5Zm0 0v6h5',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
