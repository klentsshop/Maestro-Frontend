// Archivo: talanquera-frontend/lib/utils.js
import { SITE_CONFIG } from './config';

export const cleanPrice = (valor) => {
    if (typeof valor === 'number') return valor;
    if (!valor && valor !== 0) return 0;
    const cleaned = String(valor).replace(/[^0-9]/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
};

export const formatPrecioDisplay = cleanPrice;

// ✅ Cero pérdida: traerá las 12 categorías desde el config.js
export const categoriasMap = SITE_CONFIG.categorias;

// ✅ Traerá los 3 métodos de pago desde el config.js
export const METODOS_PAGO = SITE_CONFIG.metodosPago;

export const getFechaBogota = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_CONFIG.logic.timezone || 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  // lib/utils.js

export const getStationFingerprint = () => {
    if (typeof window === 'undefined') return null;

    // 1. Intentamos leer si ya existe uno guardado
    let id = localStorage.getItem('socio_pos_pc_id');
    
    if (!id) {
        // 2. Si no existe, usamos TU lógica de la imagen para generarlo
        const screenData = `${window.screen.width}x${window.screen.height}`;
        const browserData = navigator.userAgent.replace(/\D/g, '').substring(0, 10);
        id = `PC-${screenData}-${browserData}`;
        
        // 3. LO GUARDAMOS para que no cambie aunque cambies la resolución
        localStorage.setItem('socio_pos_pc_id', id);
    }
    
    return id;
};

