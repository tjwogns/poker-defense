/** 공개 클래식 주소와 분리된 v2.2 LIFE LAB 진입 여부. */
export function isLifeLabLocation(location: Pick<Location, 'hostname' | 'pathname' | 'search'> = window.location): boolean {
  const pathname = location.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/lab')) return true;
  return ['127.0.0.1', 'localhost'].includes(location.hostname)
    && new URLSearchParams(location.search).get('experiment') === 'life';
}
