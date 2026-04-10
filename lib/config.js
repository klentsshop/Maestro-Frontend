// lib/config.js
export const SYSTEM = {
    name: "Pedidos Pro POS",
    version: "1.0.0",
    buildDate: "2026-01-04",
    developer: "Klentsshop"
};
export const SITE_CONFIG = {
    // 👤 IDENTIDAD DEL NEGOCIO
    brand: {
        name: process.env.NEXT_PUBLIC_BRAND_NAME || "Mi Restaurante",
        nit: process.env.NEXT_PUBLIC_BRAND_NIT || "000.000.000-0",
        address: process.env.NEXT_PUBLIC_BRAND_ADDRESS || "Dirección pendiente",
        phone: process.env.NEXT_PUBLIC_BRAND_PHONE || "0000000000",
        mensajeTicket: "¡Gracias por su compra!",
        currency: "es-CO",
        symbol: "$",
    },

    // 🎨 PALETA DE COLORES (SaaS Ready)
   theme: {
    // Si Netlify envía un color, lo usa; si no, usa el verde por defecto
    primary: process.env.NEXT_PUBLIC_COLOR_PRIMARY || "#10B981",
    secondary: process.env.NEXT_PUBLIC_COLOR_SECONDARY || "#166534",
    accent: process.env.NEXT_PUBLIC_COLOR_ACCENT || "#F59E0B",
    danger: "#EF4444", // El rojo de error suele ser estándar
    dark: process.env.NEXT_PUBLIC_COLOR_DARK || "#166534",
    textLight: "#FFFFFF",
    textDark: "#4B5563",
},

    // 🏷️ CATEGORÍAS PERSONALIZABLES (Tus 12 categorías originales)
   categorias: {
    todos: '🏠 TODO',
    otros: '⚙️ Otros'
},

    // 💳 MÉTODOS DE PAGO
    metodosPago: [
        { title: '💵 Efectivo', value: 'efectivo' },
        { title: '📱 Digital', value: 'digital' },
        { title: '💳 Tarjeta', value: 'tarjeta' }
    ],

    // ⚙️ LÓGICA DE OPERACIÓN
    logic: {
        timezone: 'America/Bogota',
        // Categoría que siempre va al final del ticket
        drinkCategory: "bebidas",
        // Palabras que disparan prioridad alta en cocina
        priorityKeywords: ["almuerzo", "especial", "corriente", "sopa"],
        // PIN por defecto si no hay en Sanity
        defaultAdminPin: "1234",
    },
    // 🖨️🔌 INTEGRACIÓN POS / APK (OPCIONAL)
    pos: {
        usaAPK: true,      // Cliente 1: usa APK de impresión
        usaCajon: true     // Cliente 1: tiene cajón monedero
    }
};