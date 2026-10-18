/** Role Murid/Guru diambil dari query `?role=`, default `murid` (CONTEXT.md). */
export function ambilPeran(): 'murid' | 'guru' {
  const param = new URLSearchParams(window.location.search).get('role')
  return param === 'guru' ? 'guru' : 'murid'
}