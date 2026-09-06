/** v2.2 정식 LIFE 규칙 진입 여부. ruleset=classic 또는 /classic/만 이전 규칙을 유지한다. */
export function isLifeLabLocation(location: Pick<Location, 'hostname' | 'pathname' | 'search'> = window.location): boolean {
  const pathname = location.pathname.replace(/\/+$/, '');
  const params = new URLSearchParams(location.search);
  return !pathname.endsWith('/classic') && params.get('ruleset') !== 'classic';
}
