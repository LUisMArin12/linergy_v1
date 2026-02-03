import { createClient } from '@supabase/supabase-js';
import { GeoJSONGeometry, isGeoJSONGeometry } from '../types/geo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Linea = {
  id: string;
  numero: string;
  nombre: string | null;
  km_inicio: number | null;
  km_fin: number | null;
  clasificacion: 'ALTA' | 'MODERADA' | 'BAJA';
  geom: string | GeoJSONGeometry | null;
  created_at: string;
  updated_at: string;
};

export type Estructura = {
  id: string;
  linea_id: string;
  numero_estructura: string;
  km: number;
  geom: string | GeoJSONGeometry;
  created_at: string;
  updated_at: string;
};

// Nota: Subestaciones eliminadas del sistema (cleanup).

export type Falla = {
  id: string;
  linea_id: string;
  km: number;
  tipo: string;
  descripcion: string | null;
  estado: 'ABIERTA' | 'EN_ATENCION' | 'CERRADA';
  ocurrencia_ts: string;
  geom: string | GeoJSONGeometry;
  created_at: string;
  updated_at: string;
};

export function parseGeometry(geom: string | GeoJSONGeometry | null | undefined): GeoJSONGeometry | null {
  if (!geom) return null;

  if (isGeoJSONGeometry(geom)) return geom;

  if (typeof geom !== 'string') return null;

  // 1) GeoJSON serializado
  try {
    const parsed: unknown = JSON.parse(geom);
    if (isGeoJSONGeometry(parsed)) return parsed;
  } catch {
    // ignore
  }

  // 2) WKT básico (Point / LineString)
  const upper = geom.trim().toUpperCase();

  if (upper.startsWith('POINT')) {
    const match = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const lon = Number(match[1]);
      const lat = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { type: 'Point', coordinates: [lon, lat] };
      }
    }
  }

  if (upper.startsWith('LINESTRING')) {
    const match = geom.match(/LINESTRING\s*\((.+)\)/i);
    if (match) {
      const coords = match[1]
        .split(',')
        .map((pair) => pair.trim().split(/\s+/))
        .map(([lonStr, latStr]) => [Number(lonStr), Number(latStr)] as [number, number])
        .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (coords.length >= 2) return { type: 'LineString', coordinates: coords };
    }
  }

  return null;
}


// ---- Helpers para Edge Functions ----

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function parseFetchError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return json?.error || json?.message || JSON.stringify(json);
    }
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function buildFunctionHeaders(isJsonBody: boolean) {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token ?? supabaseAnonKey}`,
  };
  if (isJsonBody) headers['Content-Type'] = 'application/json';
  return headers;
}

// ---- Funciones públicas ----

/**
 * Normaliza la respuesta del Edge Function para siempre regresar:
 * { lat: number, lon: number }
 *
 * Acepta cualquiera de estos formatos:
 * - { lat, lon } / { lat, lng } / { latitude, longitude }
 * - { data: { lat, lon } } / { data: { lat, lng } }
 * - { geom: "POINT(lon lat)" } / { wkt: "POINT(lon lat)" }
 * - { geom: { type:'Point', coordinates:[lon,lat] } } (GeoJSON)
 */
export async function computeFaultLocation(
  lineaId: string,
  km: number
): Promise<{ lat: number; lon: number }> {
  const headers = await buildFunctionHeaders(true);

  const response = await fetch(`${supabaseUrl}/functions/v1/compute-fault-location`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ lineaId, km }),
  });

  if (!response.ok) {
    const msg = await parseFetchError(response);
    throw new Error(msg || 'Failed to compute location');
  }

  const payload: unknown = await response.json();

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

  const get = (root: unknown, path: string[]): unknown => {
    let cur: unknown = root;
    for (const k of path) {
      if (!isRecord(cur)) return undefined;
      cur = cur[k];
    }
    return cur;
  };

  const pickNumber = (...candidates: unknown[]) => {
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  // 1) Intento directo: múltiples variantes
  const lat = pickNumber(
    get(payload, ['lat']),
    get(payload, ['latitude']),
    get(payload, ['data', 'lat']),
    get(payload, ['data', 'latitude']),
    get(payload, ['location', 'lat']),
    get(payload, ['location', 'latitude'])
  );

  const lon = pickNumber(
    get(payload, ['lon']),
    get(payload, ['lng']),
    get(payload, ['longitude']),
    get(payload, ['data', 'lon']),
    get(payload, ['data', 'lng']),
    get(payload, ['data', 'longitude']),
    get(payload, ['location', 'lon']),
    get(payload, ['location', 'lng']),
    get(payload, ['location', 'longitude'])
  );

  if (lat !== null && lon !== null) return { lat, lon };

  // 2) WKT: payload.geom / payload.wkt / payload.geom_wkt
  const wktCandidate = get(payload, ['geom']) ?? get(payload, ['wkt']) ?? get(payload, ['geom_wkt']);
  const wkt = typeof wktCandidate === 'string' ? wktCandidate : undefined;

  if (wkt && wkt.toUpperCase().startsWith('POINT')) {
    const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const lon2 = Number(match[1]);
      const lat2 = Number(match[2]);
      if (Number.isFinite(lat2) && Number.isFinite(lon2)) return { lat: lat2, lon: lon2 };
    }
  }

  // 3) GeoJSON: { type:'Point', coordinates:[lon,lat] }
  const geomCandidate = get(payload, ['geom']) ?? get(payload, ['geometry']);
  if (isGeoJSONGeometry(geomCandidate) && geomCandidate.type === 'Point') {
    const [lon3, lat3] = geomCandidate.coordinates;
    if (Number.isFinite(lat3) && Number.isFinite(lon3)) return { lat: lat3, lon: lon3 };
  }

  throw new Error(`compute-fault-location devolvió un formato inesperado: ${JSON.stringify(payload)}`);
}

export async function importKMZ(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = await buildFunctionHeaders(false);

  const response = await fetch(`${supabaseUrl}/functions/v1/import-kmz`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const msg = await parseFetchError(response);
    throw new Error(msg || 'Failed to import KMZ');
  }

  return response.json();
}

export interface UpdateFallaPayload {
  lineaId?: string;
  km?: number;
  tipo?: string;
  descripcion?: string | null;
  estado?: 'ABIERTA' | 'EN_ATENCION' | 'CERRADA';
  fecha?: string;
  hora?: string;
}

export async function updateFalla(fallaId: string, payload: UpdateFallaPayload) {
  let geomWkt: string | undefined;

  if (payload.lineaId !== undefined && payload.km !== undefined) {
    const location = await computeFaultLocation(payload.lineaId, payload.km);
    geomWkt = `POINT(${location.lon} ${location.lat})`;
  }

  let ocurrenciaTs: string | undefined;
  if (payload.fecha !== undefined && payload.hora !== undefined) {
    ocurrenciaTs = new Date(`${payload.fecha}T${payload.hora}`).toISOString();
  }

  const updateData: Partial<{ linea_id: string; km: number; tipo: string; descripcion: string | null; estado: 'ABIERTA' | 'EN_ATENCION' | 'CERRADA'; ocurrencia_ts: string }> = {};
  if (payload.lineaId !== undefined) updateData.linea_id = payload.lineaId;
  if (payload.km !== undefined) updateData.km = payload.km;
  if (payload.tipo !== undefined) updateData.tipo = payload.tipo;
  if (payload.descripcion !== undefined) updateData.descripcion = payload.descripcion;
  if (payload.estado !== undefined) updateData.estado = payload.estado;
  if (ocurrenciaTs !== undefined) updateData.ocurrencia_ts = ocurrenciaTs;
  if (geomWkt !== undefined) {
    const { error } = await supabase.rpc('update_falla_geom', {
      p_falla_id: fallaId,
      p_geom_wkt: geomWkt,
    });
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from('fallas')
    .update(updateData)
    .eq('id', fallaId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFalla(fallaId: string) {
  const { error } = await supabase.from('fallas').delete().eq('id', fallaId);
  if (error) throw error;
}

export async function setFallaEstado(
  fallaId: string,
  estado: 'ABIERTA' | 'EN_ATENCION' | 'CERRADA'
) {
  const { data, error } = await supabase
    .from('fallas')
    .update({ estado })
    .eq('id', fallaId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
